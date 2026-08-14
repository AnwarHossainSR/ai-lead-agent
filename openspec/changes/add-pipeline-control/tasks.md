## 1. Discovery that actually returns companies

- [ ] 1.1 Add `apps/api/src/discovery/sources/registry.ts` — a provider building the enabled sources from configuration, returning the usable ones and a `{ sourceId, reason }` for each enabled-but-unusable one (design D4)
- [ ] 1.2 Construct `FileImportSource` in the registry from a configured import path, so a run works with no API key and no third-party account
- [ ] 1.3 Construct `PlacesSource` only when its key is configured, and report it unusable with the missing setting named when it is not
- [ ] 1.4 Replace `const sources = new Map()` in `discovery.controller.ts` with the registry's usable sources
- [ ] 1.5 Make a run with no usable source end as failed, naming each source and its reason, rather than completing with zero companies stored (spec: a run with no usable source fails)
- [ ] 1.6 Record each source's returned, stored, duplicate and rejected counts against the run, including the skipped ones with their reason
- [ ] 1.7 Add an example import file under `apps/api/fixtures/` and document its columns
- [ ] 1.8 Confirm by hand: the registry's usable/unusable split, a run that stores companies from file import, a run refused for having no usable source, and the per-source report
- [ ] 1.9 Verify: `pnpm --filter @mela/api lint`, `typecheck` — and `POST /api/discovery/runs` by hand, confirming companies actually land in the database

## 2. Queue transport

- [ ] 2.1 Settle design D1 — record the decision at the top of `queue.service.ts` with its reason, so the next reader knows why the transport is what it is
- [ ] 2.2 Add `bullmq`, remove `@upstash/qstash`, and delete the QStash reachability check from `worker.ts` (as a commit of its own, so the swap is revertable alone)
- [ ] 2.3 Rewrite `queue.service.ts` on BullMQ behind its existing interface, keeping `jobs.registry.ts`'s payload schemas untouched
- [ ] 2.4 Point `QUEUE_CONFIGS` concurrency, attempts and timeouts at BullMQ's options, keeping the per-stage differences the config already declares
- [ ] 2.5 Add the queue's Redis connection to the health endpoint's existing checks
- [ ] 2.6 Update `add-background-jobs`' proposal and design to match the settled transport, so the two changes do not contradict each other
- [ ] 2.7 Verify: a job enqueued by hand is picked up by a worker against the Docker Redis, with no tunnel and no external account

## 3. Stage processors

- [ ] 3.1 Add `PIPELINE_STAGES` to `@mela/config` — the ordered chain, ending after outreach drafting (design D3)
- [ ] 3.2 Confirm the chain has no stage after drafting, and state that fact in a comment beside `PIPELINE_STAGES` so the next reader checks the data rather than trusting the code
- [ ] 3.3 Implement the discovery processor, calling the existing `RunService`
- [ ] 3.4 Implement the verification processor, calling the existing verification service
- [ ] 3.5 Implement the website-analysis processor, with the longer timeout and lower concurrency a browser launch needs
- [ ] 3.6 Implement the technology-detection processor
- [ ] 3.7 Implement the opportunity-analysis processor
- [ ] 3.8 Implement the contact-research processor
- [ ] 3.9 Implement the scoring processor
- [ ] 3.10 Implement the research-summary processor
- [ ] 3.11 Implement the outreach-draft processor, ending the chain with a draft awaiting approval
- [ ] 3.12 Register every processor in `worker.ts`, replacing the log line that currently names queues it does not consume
- [ ] 3.13 Add deterministic job ids (`${stage}:${companyId}:${runId}`) and the already-has-a-current-result skip, with a `force` flag only the manual re-run sets (design D7)
- [ ] 3.14 Confirm by hand: each processor calls its service and enqueues its successor; a failing stage does not enqueue the next; a duplicate enqueue does the work once; `force` overrides the skip
- [ ] 3.15 Verify: `pnpm --filter @mela/api lint`, `typecheck`

## 4. Pipeline runs

- [ ] 4.1 Add `pipeline_runs` and `pipeline_run_companies` to `packages/database/src/schema/`, with a nullable `pipeline_run_id` on `ai_invocations` (design D2, migration plan)
- [ ] 4.2 Generate and apply the migration
- [ ] 4.3 Add write helpers — start a run, attach a company, record a company's stage outcome, finish a run — following the existing `write/` conventions
- [ ] 4.4 Add read helpers deriving per-stage counts by aggregate query rather than from counter columns
- [ ] 4.5 Add CHECK constraints for the run's own equivalences — a finish time pairs with an outcome, a failure pairs with a reason
- [ ] 4.6 Exercise the write helpers, the derived counts and each constraint against a local database, and record what each constraint refused
- [ ] 4.7 Verify: `pnpm --filter @mela/database lint`, `typecheck`

## 5. Orchestration and ceilings

- [ ] 5.1 Add `apps/api/src/pipeline/pipeline.service.ts` — start a run, attach discovered companies to it, advance a company to the next stage, finish the run
- [ ] 5.2 Enforce the company ceiling before enqueuing further work, ending the run with that reason (spec: the company ceiling is reached)
- [ ] 5.3 Attribute model spend to the run and check the remaining budget **before** each model call, ending the run with that reason on reaching it (design D5)
- [ ] 5.4 Add `POST /api/pipeline/runs` gated `@RequiresRole("operator", "Starting a pipeline run")`, validating territory and industry against configuration before creating anything (spec: the request is checked before work begins)
- [ ] 5.5 Add `GET /api/pipeline/runs` and `GET /api/pipeline/runs/:id` with per-stage counts, per-source outcomes, failures and spend — open to any signed-in role
- [ ] 5.6 Add `POST /api/pipeline/companies/:id/stages/:stage/rerun`, operator-only, running one stage for one company with `force` set
- [ ] 5.7 Mark downstream results stale when a stage is re-run, using the existing staleness helpers (design — open questions)
- [ ] 5.8 Confirm by hand: a run refused for a viewer, a run refused for an unconfigured territory, the company ceiling, the spend ceiling, a re-run touching only its own stage, and an audit entry recording who started a run
- [ ] 5.9 Verify: `pnpm --filter @mela/api lint`, `typecheck`

## 6. The Pipeline page

- [ ] 6.1 Add `apps/web/src/lib/pipeline.ts` — typed fetches for the three endpoints
- [ ] 6.2 Add `app/(workspace)/pipeline/page.tsx` — the run list with each run's state, parameters and headline counts, built on `adopt-workspace-design`'s primitives where they have landed
- [ ] 6.3 Add the start-a-run form: country, city, industry, candidate limit, spend ceiling — visible only to an operator (spec: a viewer cannot start a run)
- [ ] 6.4 Add `app/(workspace)/pipeline/[id]/page.tsx` — per-stage progress on `StageRail`, per-source outcomes, failures with reasons, and spend against ceiling
- [ ] 6.5 Show a stage that has not run as distinct from one that ran and produced nothing (spec: not-yet-run is distinguishable from produced-nothing)
- [ ] 6.6 Poll the run while it is in progress and stop when it ends (design D6)
- [ ] 6.7 Add the Pipeline entry to the sidebar
- [ ] 6.8 Add the per-company re-run control on the company detail page, operator-only, wired to a Server Action returning an `ActionResult` so its outcome reaches a toast
- [ ] 6.9 Add the start-a-run Server Action, with its refusals surfaced as error toasts rather than a blank form
- [ ] 6.10 Confirm in the browser: the form is absent for a viewer, progress renders each stage state, a failed stage shows its reason, polling stops when a run ends
- [ ] 6.11 Verify: `pnpm --filter @mela/web lint`, `typecheck`

## 7. End to end and completion

- [ ] 7.1 Run the whole pipeline against the example import file on a local database and confirm companies arrive, get verified, analysed, scored and drafted
- [ ] 7.2 Confirm the run ends with drafts awaiting approval and nothing sent or approved (spec: the chain stops at human approval)
- [ ] 7.3 Confirm a company whose analysis fails does not proceed and the others do
- [ ] 7.4 Confirm both ceilings stop a run, and that each says which one it was
- [ ] 7.5 Update `docs/architecture.md` with the pipeline-control section — the chain table, the run model, ceilings, and the transport decision
- [ ] 7.6 Update `README.md` with how to start a run, and `docs/development.md` with the import file format
- [ ] 7.7 Add `add-pipeline-control` to the roadmap table in `docs/implementation-progress.md`
- [ ] 7.8 Verify the whole workspace: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- [ ] 7.9 Run `openspec validate add-pipeline-control --strict` and resolve anything it reports
