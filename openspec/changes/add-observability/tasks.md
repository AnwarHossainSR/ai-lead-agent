# Tasks — Add Observability

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Configuration

- [ ] 1.1 Add observability configuration to `packages/config`: redaction patterns, maximum logged string length, metrics enablement and the metric label sets
- [ ] 1.2 Add `METRICS_PORT`, `LOG_LEVEL` and `ERROR_REPORTING_DSN` to the API env schema and `.env.example` with a `.describe()` on each
- [ ] 1.3 Abort startup when the metrics port equals the application port, naming both
- [ ] 1.4 Add unit tests covering every scenario in `specs/developer-environment/spec.md`
- [ ] 1.5 Verify: `pnpm --filter @mela/config lint typecheck test` passes

## 2. The redacting logger

- [ ] 2.1 Implement the serializer replacing connection strings, API keys, session identifiers, credential-named keys at any depth, and email addresses
- [ ] 2.2 Redact the configured secret values by exact value, wherever and however they appear
- [ ] 2.3 Truncate strings beyond the configured length with a marker, so captured page content cannot fill a log
- [ ] 2.4 Handle errors, nested arrays and circular structures without throwing
- [ ] 2.5 Wrap `ConsoleLogger` with the serializer and install it in both the API and the worker
- [ ] 2.6 Add unit tests for every redaction case, including a credential inside an error message
- [ ] 2.7 Add a test asserting a redacted line still carries the event, stage, outcome and correlation identifier
- [ ] 2.8 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 3. Correlation

- [ ] 3.1 Add the `AsyncLocalStorage` context holding the correlation identifier and the process role
- [ ] 3.2 Add middleware opening the context per request, adopting an inbound header and echoing it in the response
- [ ] 3.3 Open the context per job, taking the identifier from the payload and generating one for a scheduled job
- [ ] 3.4 Copy the current correlation identifier into every enqueued payload, validated by the job schema
- [ ] 3.5 Make the logger read the identifier from the context so no call site passes it
- [ ] 3.6 Add tests: lines from one request share an identifier, an inbound header is adopted and echoed, an enqueued job inherits it, a scheduled job gets its own
- [ ] 3.7 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 4. Metrics

- [ ] 4.1 Add the metrics client and the registry, serving `/metrics` on its own port in both processes
- [ ] 4.2 Confirm the metrics path is not served on the application port
- [ ] 4.3 Record per-stage outcome counters and per-source request counters from the outcomes the stages already produce
- [ ] 4.4 Record model tokens, estimated cost and invocation duration from the existing invocation records
- [ ] 4.5 Record queue depth, job duration, HTTP status counts and database pool saturation
- [ ] 4.6 Add a test asserting every label value is drawn from a configured set and no label carries a company identifier, URL or email address
- [ ] 4.7 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 5. Error reporting

- [ ] 5.1 Capture unhandled exceptions and unhandled promise rejections in both entry points, reporting each once with its correlation identifier
- [ ] 5.2 Apply the same serializer before anything leaves the process
- [ ] 5.3 No-op when no destination is configured, and bound the shutdown flush by a timeout so the process always exits
- [ ] 5.4 Add tests: a rejection reported once, a credential-bearing error reported without the credential, an unreachable destination not blocking shutdown
- [ ] 5.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 6. Liveness and readiness

- [ ] 6.1 Add `/live` reporting only that the process is running, unaffected by dependency state
- [ ] 6.2 Add `/ready` failing when a dependency is unreachable or shutdown has begun
- [ ] 6.3 Leave `/health` and its existing tests unchanged
- [ ] 6.4 Add tests: liveness succeeds with the database stopped, readiness fails, readiness fails during shutdown while liveness succeeds
- [ ] 6.5 Verify: `pnpm --filter @mela/api lint typecheck test build` passes

## 7. The leak check

- [ ] 7.1 Add an automated check starting both processes with sentinel credential and personal data values, exercising a request, a failing request, a job and a failing job
- [ ] 7.2 Capture all output including the metrics endpoint and assert no sentinel appears
- [ ] 7.3 Confirm the check fails when a deliberate leak is introduced, then remove the leak
- [ ] 7.4 Add the check to the CI workflow
- [ ] 7.5 Verify: the check passes on a clean tree and fails on an introduced leak

## 8. Documentation and final verification

- [ ] 8.1 Document observability in `docs/architecture.md`, including why redaction is at the writer and why liveness must not check dependencies
- [ ] 8.2 Add `docs/operations.md`: the metrics exposed, reading a correlation identifier through the pipeline, and what each endpoint answers
- [ ] 8.3 Update `docs/development.md` and `docs/implementation-progress.md`
- [ ] 8.4 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 8.5 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 8.6 Run `openspec validate add-observability --strict` and resolve anything it reports
