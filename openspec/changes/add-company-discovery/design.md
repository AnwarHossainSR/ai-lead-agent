# Design — Add Company Discovery

## Context

`companies` already enforces most of what discovery must respect: `discovery_source` and `discovery_source_url` are `NOT NULL`, `normalized_domain` carries a partial unique index, `verified` defaults false, and the write helpers derive both normalization keys rather than accepting them. `packages/shared` already exports `normalizeDomain` and `normalizeCompanyName`. So the storage contract exists; this change supplies the thing that satisfies it.

Two constraints dominate the design. First, **never fabricate** — which in discovery means a candidate without a traceable source is not a candidate. Second, **never bypass anti-bot measures and respect applicable website rules** — which rules out the approach most lead-generation tooling actually takes, and therefore rules out most of the obvious sources.

## Goals / Non-Goals

**Goals:**

- Get real companies into the database from sources whose terms permit it.
- Make an untraceable candidate structurally impossible to store.
- Make a run's outcome honest, including when it found nothing.
- Make re-running over the same territory cheap and idempotent.

**Non-Goals:**

- Confirming a discovered company exists and trades — the next change.
- Fetching the company's own website — the change after that.
- Scheduling, queueing or parallelism across runs.
- A user interface.

## Decisions

### D1 — Discovery is a Nest module in `apps/api`, not a package

**Choice:** `apps/api/src/discovery/`.

**Why:** the bootstrap design already recorded that the worker process will reuse Nest modules and providers (`NestFactory.createApplicationContext`), which is why the API is a separate application in the first place. Discovery is stateful domain behaviour with dependencies to inject, not a pure function. The pure parts — normalization — are already in `packages/shared`, and stay there.

```
apps/api/src/discovery/
├─ discovery.module.ts
├─ discovery.controller.ts        POST /api/discovery/runs, GET /api/discovery/runs[/:id]
├─ discovery.service.ts           orchestrates a run
├─ dedup.service.ts               deterministic; no AI
├─ run-recorder.service.ts        per-source counts and outcomes
├─ rate-limiter.ts                per-source token bucket
├─ robots.ts                      fetch, cache, evaluate
└─ sources/
   ├─ source.ts                   DiscoverySource interface
   ├─ file-import.source.ts
   ├─ places.source.ts
   └─ directory.source.ts
```

### D2 — The adapter interface makes an unsourced candidate unrepresentable

```ts
interface DiscoveredCandidate {
  readonly name: string;
  readonly sourceUrl: string;          // required — not optional, not nullable
  readonly website?: string;
  readonly city?: string;
  readonly companySize?: string;
  readonly linkedinUrl?: string;
  readonly description?: string;
}
```

Everything an adapter cannot vouch for is optional and is stored as absent, never as an empty string and never as a guess. `sourceUrl` is the one thing that is not optional: an adapter that cannot say where a claim came from cannot express the claim.

A candidate is still validated with Zod at the boundary. An adapter is code we wrote, but it is also the thing most likely to be wrong.

### D3 — Three adapters, chosen for lawfulness rather than yield

| Adapter | Source | Why it is lawful |
|---|---|---|
| `file-import` | a CSV or JSON list the operator already has | no third party is contacted at all |
| `places` | a licensed business-listings API (Google Places or equivalent), key in the environment | a paid API with terms that permit programmatic access |
| `directory` | a public directory explicitly configured as crawlable | `robots.txt` honoured, crawl-delay honoured, rate-limited, abandoned on block |

**`file-import` is not a placeholder.** It is how the operator seeds a territory they already know, and it is the only adapter that works with no external dependency at all — which makes it the one every test uses.

**LinkedIn is not a source.** Its terms prohibit automated collection. `linkedin_url` is populated when another source publishes it.

**Search engine result scraping is not a source.** Every general search engine's terms prohibit it, and the only way to do it at volume is the evasion this project has ruled out.

**Trade-off, stated plainly:** this yields fewer companies than a tool willing to scrape LinkedIn and Google. That is the intended trade — the alternative violates a stated constraint of the project.

### D4 — `robots.txt` and rate limiting are in the request path, not a policy document

`robots.ts` fetches and caches `robots.txt` per origin (TTL 24h), and `directory.source.ts` cannot issue a request without passing a path through it. The rate limiter is a per-source token bucket taking `max(configured interval, declared crawl-delay)`.

**On a block:** an HTTP 403, 429 with no `retry-after`, or a response body matching a bot-challenge signature ends that source for the run and records `blocked`. There is deliberately no retry-with-different-headers path, no proxy setting, and no browser-fingerprint option anywhere in the module — the absence is the control, and a test asserts the configuration schema has no field that could enable one.

### D5 — Deduplication is deterministic and ordered

1. If the candidate has a website, normalize it. A match on `normalized_domain` is the same company. This is already a unique index, so the database enforces it even if this code is wrong.
2. If it has no website, compare `normalized_name` within the same `country_id`. A match is the same company.
3. Otherwise it is new.

Step 2 is deliberately narrow — same country, exact normalized match. Fuzzy matching across countries would merge "Al Noor Trading" in Dubai with "Al Noor Trading" in Riyadh, which are usually different companies. Under-merging produces a duplicate a human can spot; over-merging silently destroys a lead.

**No AI in this path.** Deduplication decides what is stored, and decisions are deterministic code.

### D6 — Schema additions

```sql
discovery_runs(
  id uuid pk, country_id text not null, city_id text, industry_id text not null,
  started_at timestamptz not null default now(), finished_at timestamptz,
  outcome discovery_run_outcome not null,   -- running|succeeded|partial|limit_reached|failed
  candidate_limit integer not null, duration_limit_seconds integer not null,
  failure_reason text,
  check (finished_at is null or finished_at >= started_at)
)

discovery_run_sources(
  id uuid pk, run_id uuid not null references discovery_runs on delete cascade,
  source_id text not null,
  outcome discovery_source_outcome not null,  -- succeeded|skipped|blocked|failed
  returned_count integer not null default 0, stored_count integer not null default 0,
  duplicate_count integer not null default 0, rejected_count integer not null default 0,
  rejections jsonb not null default '[]',     -- [{reason, count}]
  note text,
  unique (run_id, source_id),
  check (returned_count >= 0 and stored_count >= 0 and duplicate_count >= 0 and rejected_count >= 0)
)

company_discovery_sources(
  company_id uuid not null references companies on delete cascade,
  source_id text not null, source_url text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (company_id, source_id)
)

-- companies gains:
discovery_run_id uuid references discovery_runs on delete set null
```

`ON DELETE SET NULL` on the run reference: deleting a run is a housekeeping action and must not take real companies with it. `ON DELETE CASCADE` on the per-source rows: they describe the run and mean nothing without it.

### D7 — Runs are synchronous and bounded in this change

`POST /api/discovery/runs` runs to completion and returns the record. Bounded by `candidate_limit` and `duration_limit_seconds`, both with configured defaults, and only one run may be in progress per (country, industry) pair — enforced by a partial unique index on `outcome = 'running'`.

**Why synchronous:** a queue is a whole change (`add-background-jobs`), and a run against `file-import` or a rate-limited directory finishes in seconds to a couple of minutes. Building the queue first would mean testing discovery through two layers of machinery, neither of which exists yet.

**What that costs:** an HTTP request held open for the duration. Acceptable for a single-operator tool on localhost; explicitly revisited when the queue lands.

### D8 — Testing

- **Unit:** dedup ordering including the same-name-different-country case, `robots.txt` evaluation including malformed files, rate-limiter spacing, candidate validation rejecting a missing source URL, run counting.
- **Integration, real PostgreSQL:** the whole run against a `file-import` fixture — new companies stored with provenance, a second run storing nothing, per-source counts, limits ending a run while retaining what was stored.
- **A fake source** implementing the adapter interface drives blocked, failed, empty and partial outcomes. No test makes a network request.
- **The `places` adapter is tested against recorded fixtures**, not the live API — a suite that needs a billed API key does not run in CI.

## Risks / Trade-offs

- **Low yield from lawful sources only** → accepted deliberately; `file-import` means the operator is never blocked on adapter coverage, and adding a licensed source is a configuration edit.
- **The places API costs money per request** → per-source rate limit plus the run's candidate limit bound it; cost per run is predictable before it is spent.
- **A directory changes layout and the adapter silently returns nothing** → an empty result is a recorded outcome, not a silent success, and per-source counts make a source that stopped producing obvious on the next run.
- **Under-merging leaves duplicate companies** → preferred over over-merging; the dashboard change adds a review surface, and normalized-name collisions within a country are already merged.
- **A long synchronous run ties up a request** → bounded by duration, and superseded by the queue change.
- **`robots.txt` is not a licence** → it is necessary, not sufficient. Whether a source may be crawled at all is a per-source configuration decision made by a human, which is why crawl permission defaults to denied.
