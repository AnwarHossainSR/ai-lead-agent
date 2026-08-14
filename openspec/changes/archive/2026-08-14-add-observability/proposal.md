# Add Observability

**Roadmap coverage:** the `Logs: console + structured` line of the decided stack, extended to what a running pipeline actually needs.

## Why

The API emits one JSON line per event outside development and no credential reaches the output. That was the right scope for a health endpoint. It is not enough for a system that runs browsers, calls a paid model, crawls third-party hosts and processes background jobs — because when a nightly run produces forty companies instead of four hundred, the only question that matters is *which stage stopped working*, and nothing currently answers it.

Two things make this more than routine logging. Every log line in this system may contain a connection string, an API key, a person's email address or the text of a scraped page, so redaction has to be structural rather than a habit. And the platform already records outcomes honestly at every stage — `blocked`, `unreachable`, `below_threshold`, `insufficient_evidence` — so the observability layer's job is largely to surface counts that already exist rather than to invent new instrumentation.

## What Changes

**Correlated structured logging**

- A request or job identifier attached to every line emitted while handling it, so one company's journey through discovery, verification, analysis and scoring can be read as a sequence.
- A redacting serializer applied at the logger, not at each call site: connection strings, API keys, session cookies, passwords, email addresses and captured page text are replaced before anything is written.

**Metrics**

- Counters and histograms for the things that actually degrade: per-stage outcomes, per-source block rates, model spend and token usage, queue depth and job durations, HTTP status distribution, database pool saturation.
- Exposed on a metrics endpoint in a standard text format, unauthenticated only on a separately bound port that is not the application's.

**Error reporting**

- Unhandled exceptions and unhandled promise rejections captured with their correlation identifier and reported once, with the same redaction applied.

**Operational readiness**

- The existing health endpoint stays as it is. Separate liveness and readiness endpoints are added, because "the process is alive" and "the process can do work" are different questions and conflating them makes a restart loop.

## Capabilities

### New Capabilities

- `observability`: Correlated structured logs with redaction applied at the writer rather than the call site, metrics covering the failure modes this pipeline actually has, error reporting that never carries a credential or personal data, and liveness and readiness reported separately from dependency health.

### Modified Capabilities

- `developer-environment`: adds observability configuration, the metrics port, and the requirement that no credential or personal data appears in any output.

## Impact

- New module `apps/api/src/observability/`, applied to both the HTTP application and the worker.
- New dependencies: a metrics client and an error-reporting client, both configurable to no-op when unconfigured.
- No migration.
- Depends on `add-background-jobs` for the queue metrics; the logging and redaction half depends on nothing and can be built first.

## Non-goals

Deferred:

- **Distributed tracing.** Two processes and a database; a correlation identifier answers the questions a trace would, without the instrumentation cost.
- **Log shipping, retention and an aggregator.** Output goes to stdout as JSON, which is what a platform collects. Choosing a destination belongs with `add-deployment`.
- **Alerting rules.** Metrics come first; thresholds require a baseline that does not exist yet.
- **A metrics UI.** The dashboard already renders queue and pipeline state from the database; a second rendering of the same numbers is not worth it.
- **Sampling or log levels per module.** One level for the process is sufficient at this scale.
