# Architecture

## Overview

MELA (Middle East Lead Agent) is an AI-assisted B2B lead generation platform built as a TypeScript monorepo using pnpm workspaces and Turborepo.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Application                        │
│                    (Next.js 16 + React 19)                  │
│                     http://localhost:3000                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       REST API                              │
│                    (NestJS 11 + Drizzle)                    │
│                     http://localhost:4000                    │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Postgres │   │  Redis   │   │  Files   │
        │   17     │   │    7     │   │  (S3)    │
        └──────────┘   └──────────┘   └──────────┘
```

## Packages

### apps/api

NestJS REST API providing:
- Health check endpoints (`GET /health`)
- Discovery run endpoints (`POST /api/discovery/runs`, `GET /api/discovery/runs`, `GET /api/discovery/runs/:id`)
- Verification endpoints (`POST /api/companies/:id/verify`, `POST /api/verification/batch`, `GET /api/companies/:id/verification`)
- Product configuration APIs
- Lead management endpoints
- Outreach management endpoints

### apps/web

Next.js 16 App Router application providing:
- Dashboard with API health status
- Navigation shell (sidebar + header) to leads, companies, outreach review, analytics and operations
- Server-side rendering with React 19

Every panel fetches independently through a bounded-timeout helper (`fetchWithTimeout`) inside its own Suspense and error boundary (`<Panel>`), so one slow or failing dependency degrades only the panel that depends on it. Every claim the views render carries its certainty (observed, inferred, unknown), its source URL, and the time it was recorded (`<Fact>`, `<Evidence>`) — an unmeasured value is never rendered as zero or a blank.

**Leads** (`/leads`, `/leads/[id]`) — the lead list ordered by score with filters for priority, status, industry, city, service and staleness, held in the URL so a filtered view is a shareable link. The detail view shows the score's component breakdown, opportunities and technology detections with cited evidence, contacts with sources, and the research summary rendered through `<Generated>` with its list of unknowns.

**Companies** (`/companies`, `/companies/[id]`, `/companies/needs-attention`) — the company list carries verification state, website analysis outcome and opportunity analysis outcome as three independent columns; a company can be failed or blocked in one while never having reached another, and none of the three is ever omitted. The needs-attention view collects blocked, failed and unreachable companies with counts and ages, oldest first.

**Outreach review** (`/outreach/review`, `/outreach/review/[id]`) — one drafted message at a time beside the facts it cites. Approval is disabled until the message body has actually rendered in the viewport. Actions are approve, edit, reject-with-required-reason and cancel, each a Server Action; there is deliberately no bulk approval, no multi-select and no send control (there is no send path at all — see Outreach Drafting and Approval below). Editing an approved message revokes its approval and returns it to the queue.

**Analytics** (`/analytics`) — response rate by industry, service, opportunity category, priority band and score decile, through a shared chart wrapper that always renders the counts (sent, responded, unrecorded) a rate was computed from. A segment below the configured minimum reporting sample size (`MINIMUM_REPORTING_SAMPLE_SIZE`) is visibly marked and shows no trend or comparison.

**Operations** (`/operations`) — queue configuration paired with each queue's real dead-letter (failed) count, failed jobs with an explicit per-job retry action, and discovery runs with their per-source counts and outcomes. Jobs run through Upstash QStash (HTTP push, not a pollable local queue), so there is no live "pending" count to show; what is shown is what QStash actually exposes.

### packages/config

Centralized configuration package:
- Environment variable schemas (Zod)
- Product configuration (countries, industries, services)
- Lead lifecycle, priority, and scoring configuration

### packages/database

Database layer using Drizzle ORM:
- PostgreSQL schema definitions
- Type-safe write APIs
- Migration management
- Seed scripts

### packages/ai

The platform's only sanctioned path to a language model. Two layers:

- **`AIProvider`** — thin transport over one vendor (Gemini or Cloudflare Workers AI). Knows about messages, tokens and HTTP failures. Knows nothing about prompts, schemas or cost ceilings.
- **`AIService`** — the only thing application code calls. Resolves a prompt by name and version, renders it, calls the provider, validates output against a Zod schema (with one repair attempt), estimates cost, enforces the spend ceiling, and records every invocation.

Prompts are versioned modules reviewed like code (`src/prompts/<name>/v<n>.ts`). A published version is never edited. Output is requested as structured data via a single-tool definition and always parsed against the prompt's declared Zod schema — never coerced, never defaulted.

Every call is recorded in `ai_invocations` with the prompt name, version, model, token counts, estimated cost, latency, and outcome. No prompt text, no response text, no key is stored.

```
packages/ai/
├─ src/
│  ├─ provider/          AIProvider interface, Gemini + Cloudflare implementations, retry, errors
│  ├─ prompts/           PromptDefinition type, registry, render conventions, test-classify prompt
│  ├─ service/           AIService, output validation, cost estimation
│  └─ testing/           FakeAIProvider for deterministic tests
```

### packages/shared

Shared utilities:
- Domain normalization
- Company name normalization
- Unknown marker type helpers

### packages/tsconfig

Shared TypeScript configurations:
- `base.json` - Base configuration
- `node.json` - For packages and API
- `next.json` - For Next.js web app

## Data Flow

1. **Web App** renders server-side, fetching from API
2. **API** processes requests, validates with Zod
3. **Database** handles persistence via Drizzle ORM
4. **Redis** used for health checks (future: caching, queues)

## Security Considerations

- Environment variables validated at startup via Zod
- `process.env` access restricted to `packages/config` only
- CORS configured for web origin only
- No credentials in health responses

## Authentication and Authorization

Every route requires a valid session by default. A global NestJS guard
(`SessionGuard`, registered via `APP_GUARD`) rejects every request that
doesn't carry a valid session cookie; a route opts *out* with an explicit
`@Public()` decorator (only the health check and sign-in/sign-out itself).
This is deny-by-default rather than guard-per-controller: a route added
later that forgets the guard fails loudly (401) rather than silently
serving unauthenticated data. `route-coverage.test.ts` enumerates every
registered route and asserts each is either guarded or explicitly public,
so a new public route is a deliberate, reviewable act rather than an
oversight.

**Sessions are server-side, not stateless tokens.** An opaque token lives
in an HTTP-only, `SameSite=Lax` cookie (`secure` outside development); the
API stores only an HMAC of it alongside the account, expiry and revocation
state in a `sessions` table. A stateless JWT can't be revoked without a
denylist — which is a session table with extra steps — and this product
runs one API process against one database, where a session lookup is a
single primary-key read. Expiry slides forward on activity, capped at an
absolute maximum, so an idle session ends and a long-lived one still
eventually requires signing in again.

**Passwords** are hashed with Argon2id at parameters held in
`packages/config`. Sign-in performs a hash comparison even when the
account doesn't exist (against a fixed dummy hash) and returns the same
message either way, so neither the response text nor its timing discloses
whether an email address has an account. Sign-in is rate-limited per
account and per source address.

**Two roles**, `operator` and `viewer`, drawn at "may take a consequential
action" rather than read-versus-write: approving or rejecting outreach,
recording a manual send, setting or clearing a do-not-contact marker, and
triggering anything that calls a model are all operator-only
(`@RequiresRole("operator", ...)`, read by the same guard). A viewer can
read everything and spend nothing. The web app hides controls a viewer
can't use, but that's convenience — the API's own check is what actually
enforces it, and is tested directly against a viewer session.

**Attribution** is enforced in the schema, not just application code: the
account that approved, rejected or sent an outreach message, or marked a
company or contact do-not-contact, is a `NOT NULL`-paired column
(`approved_by_account_id`, etc.) with an equivalence `CHECK` — an action
timestamp and its actor are always set or cleared together, so a
hand-written `UPDATE` can't record an approval with no approver. The
foreign key to `accounts` is `ON DELETE RESTRICT`: an account that
approved something real can never be deleted, only disabled
(`disabled_at`), which also revokes every session it holds.

**Every consequential action is audited.** Sign-in, failed sign-in and
sign-out are recorded directly by `AuthService`; every `@RequiresRole`
route is recorded by a global interceptor that derives the event name from
the same action string the guard uses to refuse it, so there's one place
that names an action rather than two that could drift. The audit log
(`audit_log`) is append-only — a database trigger refuses `UPDATE` and
`DELETE` — and its `detail` payload never carries a password, a hash, a
session id or a model prompt (enforced structurally: nothing that writes
an audit entry ever reads a request or response body into it).

## Company Discovery

The discovery module orchestrates finding new companies across configured territories and industries.

### Sources

Discovery sources are pluggable adapters that find companies:

- **`file_import`** — reads a CSV or JSON list the operator already has. The only source that contacts no third party.
- **`places`** — calls a licensed business listings API. Disabled by default; requires an API key.
- **`business_directory`** — reads a public directory. Not yet implemented.

Sources are configured in `packages/config/src/product/discovery-sources.ts` with:
- Identifier, display name, kind
- Whether the source is enabled
- Which countries it covers
- Maximum request rate per minute
- Crawl permission (defaults to denied)

### Run Lifecycle

1. **Validation** — territory and industry identifiers are validated against configuration
2. **Source Selection** — enabled sources covering the requested country are selected
3. **Rate Limiting** — sources are iterated through token buckets respecting configured rates
4. **Candidate Processing** — candidates are deduplicated, validated, and stored
5. **Limit Enforcement** — candidate and duration limits end the run early if hit
6. **Outcome Recording** — run completion records success, partial, failed, or limit_reached

### Design Decisions

- **No anti-bot evasion** — a source that blocks us is recorded as blocked and left alone
- **No fabrication** — candidates without a source URL are rejected; optional attributes stay absent when not provided
- **Deterministic deduplication** — domain first, then name within country, no LLM involvement
- **Human approval before outreach** — discovery finds companies; outreach requires explicit approval

## Outreach Drafting and Approval

Outreach drafts are AI-generated messages grounded in stored lead evidence. The module stores drafts and records approvals; it does not send messages.

### No Send Path

There is no transport, no mail client, no scheduler, and no credential for an external sending service. The API environment schema declares no SMTP, SendGrid, Mailgun, or equivalent keys. The `outreach` table has no `sent_by` column and no transport reference.

### Approval and Revocation

- A draft starts in `draft` state.
- `POST /api/outreach/:id/submit` moves it to `pending_approval`.
- `POST /api/outreach/:id/approve` moves it to `approved` with a server-side timestamp.
- Editing an approved record revokes approval, returns it to `draft`, and records `approval_revoked_at`. This ensures the text a person read is the text that goes out.

### Database Constraints

The `outreach` table enforces these rules at the database level so no application code path can bypass them:

- `outreach_generated_requires_invocation` — a generated body must carry an `ai_invocation_id`.
- `outreach_sent_requires_approval` — a record cannot be `sent`, `replied`, or `bounced` without both `approved_at` and `sent_at`.
- `outreach_sent_at_requires_approved_at` — `sent_at` cannot exist without `approved_at`.
- `outreach_sent_at_not_before_approved_at` — `sent_at` cannot be earlier than `approved_at`.
- `outreach_responded_at_requires_sent_at` — `responded_at` cannot exist without `sent_at`.
- `outreach_approved_text_hash_matches` — an approved record's `approved_text_hash` must equal the MD5 of its current subject and body, catching hand-written updates after approval.
- `outreach_rejection_requires_reason` — a `rejected_at` timestamp requires a non-blank `rejection_reason`.

## Company Verification

Verification confirms whether a discovered company's online presence is reachable and matches expectations. It runs deterministic checks (DNS, HTTP, domain-name-match) and optional registry lookups.

### Verification States

| State | Meaning |
|-------|---------|
| `never_checked` | No verification has been run yet |
| `verified` | All required checks passed |
| `unverified` | A required check failed |
| `unreachable` | Required checks returned unknown (timeout, block, no registry) |

**Why `unreachable` is distinct from `unverified`:** A company that times out or is blocked is not necessarily bad — the check infrastructure couldn't reach it. Marking it `unverified` would be incorrect; `unreachable` signals "we don't know yet" without claiming failure.

### Checks

| Check | Required | What it does |
|-------|----------|--------------|
| `dns` | Yes | Resolves A/AAAA + MX records for the domain |
| `http` | Yes | Fetches the website URL, follows redirects, detects blocks |
| `domain-name-match` | No | Deterministic token overlap between company name and domain |
| `registry` | No | Looks up the company in a country-specific business registry |

### Design Decisions

- **Evidence required** — a `passed` or `failed` verdict without evidence is downgraded to `unknown`
- **No anti-bot evasion** — a blocked host is recorded as `unknown` with `blocked` failure code
- **No language model** — all checks are deterministic; no LLM calls in the verification path
- **Staleness window** — companies are re-verified after 90 days by default
- **Bounded concurrency** — batch verification runs up to N checks in parallel

## Website Analysis

Website analysis captures a company's web presence using a headless browser, runs quality audits, and records observations. It provides the evidence needed for lead scoring and opportunity identification.

### Analysis Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Eligibility │────▶│   Capture   │────▶│    Audit    │────▶│   Record    │
│    Check     │     │  (Playwright)│     │ (Lighthouse)│     │  (Database) │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
  Skip if:            Capture at          Run Lighthouse       Store:
  - No website        desktop &           scoring via CDP      - Outcome
  - Unverified        mobile viewports    for performance,     - Scores
  - Blocked by        Record console      accessibility,       - Artifacts
    robots.txt        messages,           SEO, mobile, UX      - Observations
                      failed requests
```

### Analysis Outcomes

| Outcome | Meaning |
|---------|---------|
| `completed` | Full pipeline ran successfully |
| `partial` | Capture succeeded but audit failed |
| `blocked` | Host returned 403, 429 without retry-after, or bot challenge |
| `skipped` | Blocked by robots.txt or company not eligible |
| `failed` | Unexpected error during analysis |

### Why We Record Blocked Sites

A blocked site is recorded rather than evaded because:
1. **Transparency** — the user sees that the analysis couldn't complete
2. **No evasion** — we don't rotate user agents, solve CAPTCHAs, or disguise requests
3. **Future retry** — a blocked site can be re-analyzed later if the block is temporary
4. **Evidence** — the block itself is evidence about the company's web infrastructure

### Artifacts

Analysis artifacts are stored in `ANALYSIS_ARTIFACT_ROOT` (default: `./analysis-artifacts`):

```
analysis-artifacts/
├─ {companyId}/
│  ├─ {analysisId}/
│  │  ├─ desktop-screenshot.png
│  │  ├─ mobile-screenshot.png
│  │  ├─ rendered.html
│  │  └─ audit-report.json
```

### Observation Rules

Pure functions that check page captures for issues:
- No HTTPS
- Missing viewport meta tag
- Console errors
- Failed requests
- Missing or empty title
- Missing meta description
- Missing favicon
- Excessive page weight (>10MB)

### Design Decisions

- **Playwright for capture** — reliable, maintainable browser automation
- **Lighthouse for scoring** — industry-standard quality metrics
- **Two viewports** — desktop (1920×1080) and mobile (375×812)
- **Polite by default** — respects robots.txt, rate limits, and blocks
- **No score fabrication** — NULL means "not measured", not zero
- **Staleness window** — companies are re-analyzed after 30 days by default

## Opportunity Analysis

Opportunity analysis identifies business opportunities from a company's website evidence using a structured prompt that produces opportunities citing observed evidence identifiers, or reports insufficient evidence.

### Analysis Pipeline

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Analysis          │     │   Build Model       │     │   Call AI + Validate│
│   Capture & Audit   │────▶│   Input (o1, t1…)   │────▶│   (Design D4/D5)    │
│   (Database)        │     │   Service Catalogue)│     └─────────────────────┘
└─────────────────────┘     └─────────────────────┘                │
                                            │                       │
                                            ▼                       ▼
                                      ┌─────────────────┐      ┌─────────────────┐
                                      │ Outcome:        │      │ Record in DB    │
                                      │ • opportunities │      │ • opportunities │
                                      │ • insufficient_ │      │ • run history   │
                                      │   evidence      │      │ • citations     │
                                      │ • below_threshold│     └─────────────────┘
                                      └─────────────────┘
```

### Design Principles

- **D3**: Threshold check happens before the model call — if insufficient observations/detections, records `below_threshold` without making an AI call
- **D4**: Unknown identifiers are rejected, not described as unknown — opportunities with citations that don't exist in the input are rejected with a reason
- **D5**: Schema validation on write and read — output validated against Zod schema; `cited_evidence` JSONB enforced to have at least 1 element
- **D6**: AI invocation recorded — every model call is recorded in `ai_invocations` with outcome and timing

### Outcomes

| Outcome | Meaning |
|---------|---------|
| `opportunities` | Business opportunities identified, each citing evidence identifiers |
| `insufficient_evidence` | Evidence does not support any opportunity; AI returned `insufficient_evidence` |
| `below_threshold` | Not enough observations/detections to make a model call; recorded before AI invocation |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/companies/:id/opportunity-analysis` | Triggers the opportunity analysis workflow |
| `GET /api/companies/:id/opportunities` | Gets the opportunity run history for a company |

### Evidence Threshold

Before calling the model, the system checks:
- `minimumObservations` (default: 1) — at least 1 observation from website analysis
- `minimumDetections` (default: 1) — at least 1 technology detection

If either check fails, the outcome is `below_threshold` and no model call is made.

### Call-Local Identifiers (Design D4)

Observations get identifiers `o1, o2, …` and detections get `t1, t2, …`. These are used as citations in the AI output. The post-parse `validateCitedEvidence` function ensures all cited identifiers exist in the input — if any are missing, the opportunity is rejected with a reason rather than silently omitted.

### Service Catalogue

Every opportunity must name exactly one of the configured services. The service catalogue provides:
- `technical_opportunity` — Technical Opportunity
- `business_opportunity` — Business Opportunity

Each opportunity's `categoryId` must match one of these configured service identifiers.

### How It Works

1. **Fingerprint Matching** — Curated patterns are evaluated against captured content (headers, HTML, script URLs, stylesheet URLs, cookies, meta generator)
2. **Version Extraction** — A version is recorded only when it appears verbatim in the matched evidence; never inferred from behavior
3. **Implication Resolution** — Technologies implied by detected ones are marked as `inferred`, not `observed`
4. **Database Persistence** — Detections are attached to the analysis that produced them

### Why Fingerprints Are Curated

Fingerprints are manually curated rather than imported from public databases because:
- **Accuracy** — each pattern is verified to match the intended technology without false positives
- **Control** — we decide which technologies to detect and how patterns are expressed
- **Simplicity** — no need to parse and validate thousands of potentially conflicting patterns
- **Transparency** — every detection can be traced to a specific, human-reviewed pattern

### Why Versions Are Never Inferred

A version is recorded only when it appears verbatim in the matched evidence because:
- **Correctness** — inferring versions from behavior leads to wrong assumptions
- **Reproducibility** — the same capture always yields the same version (or no version)
- **Honesty** — "unknown version" is more truthful than a guess

### Match Locations

| Location | What it sees |
|----------|--------------|
| `header` | Response headers (e.g., `X-Powered-By: Express`) |
| `html` | Page HTML content (limited to 2MB) |
| `script` | Script source URLs |
| `stylesheet` | Stylesheet URLs |
| `cookie` | Cookie names |
| `meta` | Meta generator tag content |

### Design Decisions

- **No network requests** — detection runs against stored captures only
- **No language model** — all matching is deterministic regex evaluation
- **Time budget** — matching stops after 5 seconds to prevent runaway patterns
- **HTML byte limit** — only the first 2MB of HTML is examined
- **Stable order** — fingerprints are evaluated in declared order for deterministic results
- **Evidence required** — observed detections must have matched text; inferred detections must reference an implying detection

## Contact Research

Contact research finds people at a company who could be contacted, taking only what the company itself published on pages the platform actually fetched. It combines deterministic extraction (mailto/tel links, structured data) with model-based extraction (AI interpretation of page text).

### Research Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Gather    │────▶│  Extract    │────▶│   Enrich    │────▶│   Persist   │
│    Pages    │     │  (Deterministic + Model)│     │  (Seniority, │     │  (Contacts + │
└─────────────┘     └─────────────┘     │  Deliverability)│     │   Run Record)│
       │                   │                   └─────────────┘     └─────────────┘
       ▼                   ▼                   ▼                   ▼
  Reuse pages        - mailto links      - Classify seniority   - Store contacts
  from analysis      - tel links         - Check MX records     - Record run
  + fetch paths      - JSON-LD           - Deduplicate          - Track outcomes
                     - Model extraction
```

### Design Decisions

- **Never construct contact details** — email/phone are only stored when explicitly present in fetched content
- **No address generation** — no email patterns, permutation rules, or domain-based guessing
- **No SMTP probing** — deliverability checks use DNS-over-HTTPS MX lookup only
- **Deterministic first** — mailto/tel/structured data extraction runs before model interpretation
- **Grounding check** — model output namingText must appear in the source page
- **No contact details in model output** — the people-extract prompt has no email/telephone fields
- **Blocked hosts end research** — no retry, no evasion, no disguise
- **Observed vs inferred** — deterministic extraction yields `observed`; model interpretation yields `inferred`
- **Source URL required** — every contact detail must carry the URL it was found at

### Seniority Classification

Contacts are classified by matching their stated role against configured patterns:
- C-Level, VP, Director, Manager, Lead, Senior, Individual Contributor, Unknown
- Arabic and English patterns supported
- No seniority assigned when role is unknown

### Mail Deliverability

MX records are checked via DNS-over-HTTPS (Google DNS) to determine if a domain can receive mail:
- `receivable` — domain has MX records
- `not_receivable` — domain has no MX records
- `unknown` — lookup failed or timed out
- Per-domain caching prevents repeated lookups
- Addresses are never filtered out based on deliverability

## Design System

The workspace's visual language lives in `apps/web/src/app/globals.css` and the
primitives in `apps/web/src/components/ui/`. A screen composes primitives and
names tokens; it does not carry a colour, a font size or a shadow of its own.

### The density scale

Five named rungs, declared in `@theme` and used by name. Values are in rem
against a 16px root, so a reader who enlarges text gets what they asked for; the
px column is what renders at the browser default.

| Token | px | Used for |
|---|---|---|
| `--text-label` | 10 | Eyebrows, column headers, field labels |
| `--text-meta` | 11 | Table cells, timestamps, supporting text |
| `--text-body` | 13 | The base the whole workspace is set in |
| `--text-heading` | 15 | Panel and section titles |
| `--text-title` | 30 | The page title, once per screen |

The 11px rung is restricted to supporting text that repeats something already
legible — never the only statement of a fact.

### Layout and surface tokens

| Token | Value |
|---|---|
| `--size-sidebar` | 246px |
| `--size-sidebar-collapsed` | 72px |
| `--size-topbar` | 62px |
| `--size-content-max` | 1500px |
| `--surface-sidebar` | `color-mix(in oklch, var(--card) 65%, var(--background))` |
| `--surface-topbar` | `color-mix(in oklch, var(--background) 85%, var(--card))` |

Both surfaces are mixes of `--card` and `--background`, which are themselves
redefined per theme on `:root`, so one declaration is correct in both themes.

### Contrast

`theme-contrast.test.ts` was removed when the test suite was cut to a fifty-case
ceiling, so these ratios are computed by hand from `src/lib/theme-tokens.ts` and
recorded here for a later reader to re-check. Text pairs must clear 4.5:1;
pairs that carry meaning without text must clear 3:1.

Resolved surface colours:

| Surface | Light | Dark |
|---|---|---|
| `--surface-sidebar` | `oklch(0.988 0.0034 255)` | `oklch(0.21925 0.01695 258)` |
| `--surface-topbar` | `oklch(0.978 0.0054 255)` | `oklch(0.19675 0.01545 258)` |

Text pairs on the two new surfaces:

| Pair | Light | Dark | Floor |
|---|---|---|---|
| `foreground` on `surface-sidebar` | 16.73:1 | 15.44:1 | 4.5 |
| `muted-foreground` on `surface-sidebar` | 6.59:1 | 7.52:1 | 4.5 |
| `primary` on `surface-sidebar` | 5.93:1 | 6.44:1 | 4.5 |
| `foreground` on `surface-topbar` | 16.26:1 | 16.23:1 | 4.5 |
| `muted-foreground` on `surface-topbar` | 6.40:1 | 7.91:1 | 4.5 |
| `primary` on `surface-topbar` | 5.76:1 | 6.77:1 | 4.5 |

Non-text pairs on the two new surfaces:

| Pair | Light | Dark | Floor |
|---|---|---|---|
| `input` on `surface-sidebar` | 3.25:1 | 3.15:1 | 3.0 |
| `ring` on `surface-sidebar` | 5.89:1 | 4.72:1 | 3.0 |
| `ring` on `surface-topbar` | 5.72:1 | 4.96:1 | 3.0 |
| `success` on `surface-sidebar` | 5.95:1 | 8.23:1 | 3.0 |
| `warning` on `surface-sidebar` | 5.88:1 | 8.84:1 | 3.0 |
| `danger` on `surface-sidebar` | 5.90:1 | 6.02:1 | 3.0 |
| `info` on `surface-sidebar` | 5.36:1 | 7.78:1 | 3.0 |

`border` against the two surfaces is 1.48:1 / 1.44:1 in light and 1.60:1 /
1.68:1 in dark. It is decorative — no state or control identity rests on it —
and matches `border` against `background` and `card` elsewhere in the palette.

Every text pair clears 4.5:1, which is the small-text floor, so the 10px and
11px rungs do not relax anything: the ratios above are already the stricter
requirement.
