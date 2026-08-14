## Why

The pipeline is built and cannot be run. All thirteen stages exist as 58 HTTP
endpoints, the data model records provenance for every one of them, and the
review queue works — but there is no way to start any of it from the product.
Three specific gaps:

1. **Discovery finds nothing.** `discovery.controller.ts` builds its run with
   `const sources = new Map()` — an empty source map. `PlacesSource` and
   `FileImportSource` are both written and unit-tested, and neither is ever
   instantiated in production code. A run therefore completes, records itself,
   and stores zero companies.
2. **Nothing in the web app starts a stage.** The route list is dashboard,
   leads, companies, outreach review, analytics, operations, api-status. Every
   pipeline stage is reachable only by `curl`.
3. **The worker registers no processors.** `worker.ts` boots, checks QStash is
   reachable, logs which queues it would consume, and consumes none.

The intended experience is one control: choose a territory and an industry,
press a button, and watch companies arrive, get verified, analysed, scored and
drafted — stopping, as it always must, at a person's approval.

**Roadmap coverage:** completes the surface half of `add-background-jobs` (12)
by giving the pipeline a way to be started and watched, and closes the
discovery-source gap left open since `add-company-discovery` (2).

## What Changes

**A discovery source that actually returns companies**

- `FileImportSource` is wired into the discovery controller so a CSV of
  candidates can be imported today, with no API key, no cost and no third-party
  terms to accept. This is what makes the button work on day one.
- `PlacesSource` becomes selectable when a key is configured, and stays
  disabled and visibly so when it is not — a source that cannot be used must
  not look usable.
- The controller stops passing an empty map and instead builds the source set
  from configuration, reporting per source which ones ran and which were
  skipped.

**A pipeline run: one record that owns a whole cascade**

- A `pipeline_runs` record spanning discovery through drafting, holding what was
  requested, which stages have completed, how many companies are at each stage,
  and what failed. Discovery runs already record themselves; this is the level
  above, so "what is happening right now" is one row rather than a join across
  nine tables.
- Stage completion enqueues the next stage for the companies that passed it.
  **The chain stops at a draft awaiting approval.** Nothing enqueues a send,
  because nothing sends.

**Worker processors, so the queues are real**

- A processor per stage, each calling the service that already implements it.
  The services do not change — they were built as services, not controllers,
  for this.
- Idempotency, retry and rate limits per stage, because a browser job and a
  model call fail differently and cost differently.

**A control surface in the web app**

- A **Pipeline** page: start a run (country, city, industry, candidate limit,
  which stages to include), see runs in progress with per-stage counts, and
  see what failed with the reason.
- Per-company and per-lead controls to re-run a single stage, for the case
  where one company's analysis failed and the rest are fine.
- Live progress without a manual refresh.

**A spend and rate ceiling that a person set**

- A run declares its own ceiling: how many companies, how much model spend.
  The run stops and says so when it reaches either, rather than discovering the
  limit through a bill.

## Non-goals

Deliberately deferred, and **not** part of this change:

- **Sending anything.** No email transport, no LinkedIn automation. The chain
  ends at a draft. Human approval before outreach is a product principle, not a
  setting.
- **Scraping the open web for company listings.** Discovery reads a licensed
  API or an import file. Crawling directories to harvest business records is a
  terms-of-service and data-protection question this change does not open.
- **Scheduled and recurring runs.** A run is started by a person here. Cron-like
  scheduling belongs with `add-background-jobs`' repeatable-job section.
- **Multi-tenant or multi-user concurrency.** One operator, one machine.
- **Replacing the UI redesign.** `redesign-web-ui` is mid-flight; the Pipeline
  page uses whatever primitives exist when it is built.

## Capabilities

### New Capabilities

- `pipeline-control`: starting a pipeline run from the product, carrying
  companies through the stages automatically up to the human approval gate,
  reporting each stage's real progress and failures, enforcing the ceilings the
  run declared, and letting a single stage be re-run for a single company.

### Modified Capabilities

- `company-discovery`: discovery currently specifies sources that are never
  constructed. The requirement changes from "sources exist" to "a run uses the
  configured sources, and reports which ran, which were skipped, and why" —
  including that a run with no usable source is a stated refusal rather than a
  success that stored nothing.

## Impact

- **`apps/api/src/discovery/`** — controller builds a real source set; a source
  registry module.
- **`apps/api/src/worker/`** — processors per stage; `worker.ts` registers them.
- **`apps/api/src/pipeline/`** (new) — run orchestration, stage chaining,
  ceiling enforcement, progress reporting.
- **`packages/database/`** — new `pipeline_runs` and `pipeline_run_stages`
  tables, and a migration.
- **`apps/web/src/app/(workspace)/pipeline/`** (new) — start form, run list,
  run detail with live progress.
- **Queue transport** — see design D1. The decided stack says BullMQ on Redis;
  the code on disk uses Upstash QStash, which is HTTP-push and needs a public
  URL. This change has to resolve that before processors can run locally.
- **Depends on** `add-background-jobs` (12) for the queue layer. That change's
  proposal is stale in one respect — it describes BullMQ while the code uses
  QStash — and this change's D1 settles it.
- **No change** to the approval, sending or audit paths.
