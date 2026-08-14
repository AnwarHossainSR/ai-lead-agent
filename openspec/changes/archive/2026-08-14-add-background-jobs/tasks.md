# Tasks — Add Background Jobs

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Queue configuration and the worker process

- [x] 1.1 Add per-queue configuration to `packages/config`: concurrency, attempts, backoff, timeout and rate limit, validated at load with a positive-concurrency check
- [x] 1.2 Add `bullmq` to `apps/api` with a pinned version, confirming it resolves the existing pinned `ioredis`
- [x] 1.3 Add `apps/api/src/worker.ts` booting `AppModule` through `NestFactory.createApplicationContext`, with no HTTP server
- [x] 1.4 Add the `worker` script and wire it into the root development command so `pnpm dev` starts three processes
- [x] 1.5 Report the consumed queues at worker startup, and report an unreachable Redis with an actionable message
- [x] 1.6 Implement graceful shutdown stopping intake and releasing or finishing the active job
- [x] 1.7 Add worker environment variables to the API env schema and `.env.example`
- [x] 1.8 Verify: `pnpm dev` starts all three processes and the worker reports its queues

## 2. Job definitions and payload validation

- [x] 2.1 Define the job registry: one entry per stage carrying its queue, payload schema and handler
- [x] 2.2 Validate payloads on enqueue, refusing an invalid payload and writing nothing to the queue
- [x] 2.3 Validate payloads on processing, failing without retry and naming the invalid fields
- [x] 2.4 Add unit tests including a queued payload missing a field a later schema requires
- [x] 2.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 3. Idempotency and currency

- [x] 3.1 Derive deterministic job identifiers from the job type and subject
- [x] 3.2 Add the currency check per stage, completing a job as skipped with its reason and performing no work
- [x] 3.3 Add the `force` payload flag bypassing the currency check
- [x] 3.4 Add integration tests against real Redis: duplicate enqueue absorbed, re-enqueue after completion permitted, different subjects distinct, current result skipped without launching a browser or calling a model
- [x] 3.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes with the Compose stack running

## 4. Retry classification and bounds

- [x] 4.1 Classify failures as transient, blocked, refused or validation, retrying only the transient with exponential backoff
- [x] 4.2 Enforce the per-queue timeout, failing a hanging job with a timeout reason
- [x] 4.3 Retain exhausted jobs as failed with the reason of their final attempt, and cap completed job retention by count and age
- [x] 4.4 Add integration tests for each classification and for the timeout and exhaustion paths
- [x] 4.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 5. Stage handlers

- [x] 5.1 Add handlers for discovery, verification, website analysis and technology detection, calling the existing services unchanged
- [x] 5.2 Add handlers for contact research, opportunity analysis, scoring, research summary and reply classification
- [x] 5.3 Confirm per-host politeness limits still apply within a worker running several jobs concurrently
- [x] 5.4 Add integration tests asserting host request spacing survives concurrency
- [x] 5.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 6. Chaining, stopping before approval

- [x] 6.1 Enqueue the next stage on completion, following the chain from discovery through research summary
- [x] 6.2 Confirm drafting is not chained and nothing is enqueued after a draft
- [x] 6.3 Add the absence test: no registered job type transmits a message, and no scheduled or chained job approves one
- [x] 6.4 Add an end-to-end test running a company from discovery to research summary through the queue
- [x] 6.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 7. Scheduled maintenance

- [x] 7.1 Add repeatable jobs for re-verification, re-analysis, rescoring, no-response marking and artifact pruning, each driven by an existing staleness query
- [x] 7.2 Bound each by a configured maximum per run and make each individually disableable
- [x] 7.3 Use a fixed repeatable key per schedule so a worker restart re-registers rather than duplicating
- [x] 7.4 Add integration tests: stale subjects enqueued, the per-run bound respected, a disabled schedule not registered, a restart not duplicating
- [x] 7.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 8. Queue observability

- [x] 8.1 Add `GET /api/queues` returning waiting, active, completed, failed and delayed counts per queue
- [x] 8.2 Add `GET /api/queues/:name/failed` listing failed jobs with type, subject, attempts and final reason
- [x] 8.3 Add `POST /api/queues/:name/failed/:id/retry` re-enqueueing one job while its earlier failure remains visible
- [x] 8.4 Add a queue indicator to the Terminus health check, bounded by the same 2-second timeout, returning 503 when unreachable
- [x] 8.5 Add API tests covering every remaining scenario in `specs/background-jobs/spec.md`
- [x] 8.6 Verify: `pnpm --filter @mela/api lint typecheck test build` passes

## 9. CI, documentation and final verification

- [x] 9.1 Confirm the workflow's Redis service reaches the background job tests, and that a failing job test fails the run
- [x] 9.2 Add the dedicated Redis database index and the flush-between-files convention to the test harness
- [x] 9.3 Document the worker, the queues and the chain in `docs/architecture.md`, stating where the chain stops and why
- [x] 9.4 Document running and inspecting the worker in `docs/development.md`
- [x] 9.5 Update `docs/implementation-progress.md`
- [x] 9.6 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [x] 9.7 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [x] 9.8 Run `openspec validate add-background-jobs --strict` and resolve anything it reports
