## Context

See `proposal.md` — Why. The constraints that shape the approach:

- **The stages are already services.** `RunService`, `VerificationService`,
  `AnalysisService`, `ScoringService`, `OutreachService` and the rest are Nest
  providers that controllers call. A processor can call the same provider. No
  stage logic needs rewriting — this change is wiring, orchestration and a
  surface, not new pipeline behaviour.
- **The queue layer is half-built and off-stack.** `apps/api/src/worker/`
  holds `jobs.registry.ts` (nine job definitions with Zod payload schemas),
  `job.service.ts` (a `wrapProcessor` that validates payloads) and
  `queue.service.ts` — built on `@upstash/qstash` 2.11.3. `worker.ts` boots,
  pings QStash, logs the queue names and registers **no processors**.
- **QStash is HTTP push.** It delivers by calling a public URL. On a laptop
  that means a tunnel and an Upstash account before a single job can run.
  The project's decided stack says something different: *"Queue: BullMQ on
  Redis (local Docker; Upstash/ElastiCache later)"*. Redis is already in
  `docker-compose.yml`, already health-checked, and currently used by nothing.
- **`add-background-jobs` (0/52 tasks) covers the queue layer** — processors,
  retries, idempotency, scheduled maintenance, queue observability. Its
  proposal describes BullMQ, which no longer matches the code. This change
  depends on that one and settles the contradiction in D1.
- **Discovery has two written, tested, never-instantiated sources.**
  `FileImportSource` (reads a file) and `PlacesSource` (calls a licensed API
  with a key). `discovery.controller.ts:113` passes `new Map()`.
- **Nest services are request-scoped by default but these are singletons**, so
  a processor resolving them from an application context works the same way the
  HTTP path does.
- **The UI is mid-redesign.** `redesign-web-ui` is at 53/78; groups 8–13 restyle
  the existing pages. The Pipeline page is new, so it is built on whatever
  primitives exist at the time and does not block that work.

## Goals / Non-Goals

**Goals:**

- One button that works on a laptop, offline, with no third-party account.
- Stage chaining that is a property of the system, not of a script an operator
  remembers to run.
- Progress that reflects reality — including that a stage has not run yet,
  which is different from having run and found nothing.
- Ceilings that stop a run before a cost is incurred, not after.

**Non-Goals (design-level):**

- No rewrite of any stage service. If a stage needs changing to be callable
  from a processor, that is a defect in this design, not licence to redesign
  the stage.
- No new state machine for lead status. `LIFECYCLE` in `@mela/config` already
  owns transitions; the pipeline drives it, it does not replace it.
- No websocket infrastructure. Progress polls (D6).
- No general-purpose workflow engine. Nine known stages in a known order.

## Decisions

### D1 — Queue transport: BullMQ on Redis, replacing QStash

**This is the decision to settle before anything else, and the one most worth
disagreeing with.**

The code has drifted from the decided stack. `@upstash/qstash` is installed and
`QueueService` is built on it, while the project context says BullMQ on Redis
with Upstash later. The two are not interchangeable:

| | QStash | BullMQ on Redis |
|---|---|---|
| Delivery | HTTP push to a public URL | Worker pulls from Redis |
| Local development | Needs a tunnel + Upstash account | Works offline, Redis already running |
| Long jobs (a browser launch) | Bounded by HTTP timeout | Bounded by the worker |
| Cost at rest | Per message | None locally |
| Deployment | Serverless-friendly | Needs a running worker process |

The product is a solo operator's tool run on a laptop, and the heaviest stage
launches Playwright and Lighthouse — minutes of work, badly suited to an HTTP
request-response. **Recommendation: move to BullMQ on Redis**, keep the
existing `jobs.registry.ts` payload schemas unchanged, and rewrite
`queue.service.ts` behind the same interface. Redis is already in
`docker-compose.yml` and otherwise unused.

**Alternative considered — keep QStash and add a local tunnel:** rejected
because it makes "press the button" depend on a public URL and a paid account
for a laptop tool, and because it does not fix the browser-job timeout problem.

**Alternative considered — no queue at all, run stages in-process:** rejected.
It is what the code does today via HTTP, and it is why a browser crash takes
down a request. Also explicitly what `add-background-jobs` exists to stop.

**If this recommendation is rejected**, the rest of this design still holds —
D2 onward is transport-agnostic — but every task in group 2 changes, and local
development gains a tunnel prerequisite.

### D2 — `pipeline_runs` is a view over the stages, not a second source of truth

Each stage already records its own truth: `discovery_runs`, `verification_checks`,
`website_analysis`, `opportunity_analysis_runs`, `leads`, `outreach`. A
`pipeline_runs` row holds only what no stage table can know — what was
requested, which ceilings, when it started and ended, and how it ended — plus a
`pipeline_run_companies` join recording which companies belong to the run and
which stage each has reached.

Per-stage **counts are derived by query**, not incremented in a column.

**Why not** counter columns updated by each processor: two writers and a retry
mean a count that drifts from the rows it claims to describe, and a wrong count
on an operations page is worse than a slow one.

### D3 — The chain is a lookup table, not logic spread across processors

```
discovery → verification → website-analysis → technology-detection
  → opportunity-analysis → contact-research → scoring
  → research-summary → outreach-draft → (stop)
```

One `PIPELINE_STAGES` array in `@mela/config` names the order. Each processor,
on success, asks the table what comes next and enqueues it. Ending the chain is
the absence of a next entry — so "the pipeline stops before sending" is a
property of the data, checkable by a test that reads the table, rather than a
missing `if` somebody could add.

**Why not** each processor naming its own successor: the chain then exists only
in nine separate files and cannot be asserted about as a whole.

### D4 — Discovery sources come from a registry, and an unusable one says so

A `DiscoverySourceRegistry` provider builds the enabled sources at startup:
`FileImportSource` always (it needs only a path), `PlacesSource` when a key is
configured. It returns, alongside the usable sources, a list of
`{ sourceId, reason }` for each enabled-but-unusable one.

`discovery.controller.ts` takes the registry's map instead of `new Map()`. A run
with an empty usable set **fails**, naming each source and its reason — the
spec requirement that a run must not succeed having stored nothing.

**Why file import first:** it works today with no key, no cost and no
third-party terms, so the button is demonstrable end-to-end on day one and the
Places integration becomes an addition rather than a prerequisite.

### D5 — Ceilings are checked before the call, and spend is attributed to the run

`ai_invocations` already records `estimated_cost_usd` per call, and
`spendInWindow` already sums it. The run gains a `pipeline_run_id` on the
invocation so spend is attributable, and every model-calling processor checks
the run's remaining budget **before** invoking. The company ceiling is checked
before enqueuing the next stage.

**Why before rather than after:** a ceiling enforced after the call has already
spent the money it exists to protect.

### D6 — Progress by polling, not by websocket

The run detail page polls a `GET /api/pipeline/runs/:id` endpoint every few
seconds while the run is in progress, and stops when it ends. Every read path in
this app is already `cache: "no-store"` and server-rendered; polling fits that
without adding a second transport, a connection lifecycle, and a reconnect
story for one page.

**Why not** Server-Sent Events: defensible, and worth revisiting if the polling
interval ever has to drop below about two seconds. It does not, for a pipeline
whose fastest stage takes seconds.

### D7 — Idempotency by deterministic job id

A job's id is `${stage}:${companyId}:${runId}`. Enqueuing it twice is one job.
A processor additionally checks whether a current result already exists for that
company and stage, and skips when it does — except when the job carries an
explicit `force` flag, which only the manual re-run control sets.

**Why both:** the id stops a duplicate enqueue, and the result check stops
redundant work across two different runs that both reach the same company.

### D8 — Role gating reuses `@RequiresRole`

Starting a run and re-running a stage are operator-only, expressed with the
existing decorator, so the audit interceptor records them the way it records
approvals. A viewer sees runs and progress, and no control that starts work.

## Risks / Trade-offs

- **D1 is a stack reversal and the largest single risk here.** → It is called
  out as the first decision, it is reversible before any processor is written,
  and the payload schemas in `jobs.registry.ts` survive either way. Nothing
  downstream of D2 depends on which transport wins.
- **A cascading pipeline can spend real money quickly** — nine stages across a
  hundred companies, several calling a model → D5's per-run ceiling, checked
  before each call, plus the existing global spend ceiling in the AI provider.
  The default candidate limit stays small.
- **A cascading pipeline can also hammer someone's website** → the politeness
  and rate limits from `add-company-discovery` and `add-website-analysis` are
  already implemented in the services the processors call; the processors add
  per-queue concurrency on top rather than replacing it.
- **"Press a button and it does everything" is exactly the shape of a system
  that sends something nobody read** → the chain table (D3) has no entry after
  drafting, there is no send transport in the codebase, and both the spec and a
  test assert it. This is the risk the whole product is organised around, and
  it does not get relaxed for convenience.
- **A partially-failed run is the normal case, not the exception** — sites
  block, models refuse, contacts are not found → per-company stage state (D2)
  rather than a single run status, so one company failing analysis is visible
  as exactly that and the other ninety-nine proceed.
- **Polling load** (D6) → the endpoint reads counts by aggregate query, the
  page stops polling when the run ends, and one operator means one poller.
- **This change depends on `add-background-jobs`, which is 0/52** → group 2
  here implements only the processors this pipeline needs, not that change's
  full scope (scheduled maintenance, queue metrics, prune jobs). Those stay
  with it. Overlap is limited to the transport, which D1 settles for both.

## Migration Plan

One migration adding `pipeline_runs`, `pipeline_run_companies`, and a nullable
`pipeline_run_id` on `ai_invocations`. Nullable because every existing
invocation predates runs, and backfilling a run identifier onto invocations
that had none would be inventing data.

If D1 is accepted, removing `@upstash/qstash` is a separate commit from adding
`bullmq`, so the transport swap is revertable on its own.

Rollout is the task order below: the discovery source first, because it is the
one piece that makes the current HTTP endpoint useful even before any queue
exists — a run can be triggered by `curl` and actually store companies, which
is the smallest demonstration that the rest is worth building.

## Open Questions

- **Which licensed listings API for `PlacesSource`.** Deferred without cost:
  D4's registry makes a source pluggable, and file import carries the feature
  until a key exists. The decision is a commercial one about terms and price,
  not a technical one.
- **Whether re-running a stage should invalidate downstream results.** If an
  analysis is re-run, the score computed from the old analysis is stale. The
  change ships marking it stale — `listStaleLeads` already exists — and
  automatic re-scoring can follow once the manual path is observed in use.
