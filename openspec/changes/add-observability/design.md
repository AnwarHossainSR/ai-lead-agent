# Design — Add Observability

## Context

`apps/api` already uses Nest's `ConsoleLogger` with `json: true` outside development, and the credential-safety property is currently upheld *upstream*: the environment loader strips raw values from validation errors, and the health checks build messages from a fixed vocabulary with only an error code carried through. That works because the surface is small. It stops working the moment a pipeline stage logs an error object from a driver, a scraped page, or a contact record.

The pipeline stages already record honest outcomes — `blocked`, `unreachable`, `below_threshold`, `insufficient_evidence`, `limit_reached` — so most of what a metrics layer needs to say already exists as data. This change surfaces it as counters rather than inventing new instrumentation.

## Goals / Non-Goals

**Goals:**

- Make one company's journey through the pipeline readable as a sequence.
- Make redaction impossible to forget.
- Count the things that actually degrade.
- Separate "alive" from "able to work".

**Non-Goals:** distributed tracing; log shipping and retention; alerting thresholds; a metrics UI; per-module log levels.

## Decisions

### D1 — Redaction in the serializer, because call-site discipline does not survive

A custom `LoggerService` wrapping `ConsoleLogger`, with a serializer that walks every payload before writing and replaces:

| Pattern | Replaced with |
|---|---|
| `postgres://`, `postgresql://`, `redis://`, `rediss://` URLs | `<redacted:connection-string>` |
| values matching known API key shapes, and the configured secrets by value | `<redacted:credential>` |
| email addresses | `<redacted:email>` |
| keys named `password`, `token`, `secret`, `authorization`, `cookie`, `apiKey` at any depth | `<redacted>` |
| strings longer than a configured length | truncated with a marker |

**Redacting the configured secret values by value** is the important one: the loader already holds `DATABASE_URL`, `ANTHROPIC_API_KEY` and `SESSION_SECRET`, so their exact strings are known and can be replaced wherever they appear, however they got there.

The length truncation catches captured page content, which is not secret but is unbounded and would otherwise fill a log with a company's homepage.

**Why not rely on call sites:** the existing approach — every message built from a fixed vocabulary — works for six call sites and cannot be sustained across nine pipeline stages, nine job handlers and a UI. A serializer that cannot be bypassed is the only version that stays true.

Cost: an object walk per line. Bounded by depth and key count, and these are not request-path-hot.

### D2 — Correlation via `AsyncLocalStorage`

An `AsyncLocalStorage` store holds `{ correlationId, role }`. Middleware opens it per request, adopting an inbound `x-correlation-id` when supplied and returning it. The job processor opens it per job, taking the identifier from the payload where the enqueuing context had one.

The logger reads the store. No call site passes an identifier, which is why every line has one.

**Why not a trace:** two processes, one database. The question being asked is "what happened to company X last night", which a grep for one identifier answers. OpenTelemetry would add a collector, an exporter and a backend to answer the same question.

Every enqueue copies the current correlation identifier into the job payload — one field on the already-validated schema, so it is checked like everything else.

### D3 — Metrics on their own port

A second HTTP server on `METRICS_PORT`, serving only `/metrics`. Startup aborts if it equals `API_PORT`.

**Why separate:** the application port will eventually be reachable by something other than the operator, and metrics carry an operational picture that does not belong there. A separate port is trivially firewalled and needs no auth logic of its own.

What is recorded:

| Metric | Type | Labels |
|---|---|---|
| `pipeline_stage_outcomes_total` | counter | stage, outcome |
| `discovery_source_requests_total` | counter | source, outcome |
| `ai_tokens_total`, `ai_cost_usd_total` | counter | prompt, version, model |
| `ai_invocation_duration_seconds` | histogram | prompt, model |
| `queue_depth` | gauge | queue, state |
| `job_duration_seconds` | histogram | queue, outcome |
| `http_requests_total` | counter | method, route, status |
| `db_pool_connections` | gauge | state |

Labels are bounded sets — stage, outcome, source, prompt, queue are all configured identifiers. **No label carries a company id, a URL or an email**, which is both a cardinality rule and a privacy one, and a test asserts the label value sets are drawn from configuration.

### D4 — Error reporting is optional and cannot block shutdown

`process.on('uncaughtException')` and `process.on('unhandledRejection')` in both entry points, reporting through a client that no-ops when `ERROR_REPORTING_DSN` is unset. The same serializer from D1 is applied before anything is sent — an error report is an outbound network call carrying arbitrary payload, which is the most dangerous place a credential could end up.

Flush on shutdown is bounded by a timeout, and the process exits regardless. A reporter that cannot be reached must not prevent a restart.

### D5 — Liveness, readiness and health are three different questions

| Endpoint | Answers | Fails when |
|---|---|---|
| `/live` | is the process running | it is not |
| `/ready` | can it serve work | a dependency is unreachable, or shutdown has begun |
| `/health` | what is the state of each dependency | unchanged from today |

**Why this matters concretely:** if liveness checked the database, a database outage would make an orchestrator restart every API instance repeatedly — turning a recoverable dependency failure into an outage of everything. `/ready` failing during shutdown is what lets in-flight work finish.

`/health` keeps its existing behaviour and its existing tests.

### D6 — Testing

- **The leak test:** start both processes with `DATABASE_URL`, `ANTHROPIC_API_KEY` and `SESSION_SECRET` set to recognisable sentinel values, exercise a request, a failing request, a job and a failing job, capture all output including metrics, and assert no sentinel appears. This is the requirement's own scenario, and it is the test that fails when someone adds a careless log line.
- **Unit:** the serializer against payloads with credentials at depth, in error messages, in arrays, and in circular structures; email redaction; length truncation.
- **Correlation:** lines from one request share an identifier; an inbound header is adopted and echoed; an enqueued job inherits it; a scheduled job gets its own.
- **Metrics:** label values drawn only from configured sets; the metrics path not served on the application port.
- **Liveness and readiness:** liveness succeeds with the database stopped; readiness fails; readiness fails during shutdown while liveness succeeds.

## Risks / Trade-offs

- **The serializer adds per-line cost** → bounded by depth and key count; these are analysis processes, not a request-path-hot service.
- **Over-redaction hides useful detail** → markers name what was removed, and the correlation identifier plus stage and outcome remain, which is what diagnosis actually needs.
- **Redaction patterns will miss a novel secret shape** → the configured secret values are redacted by exact value regardless of shape, which covers the credentials this system actually holds.
- **A second HTTP server per process** → one route, no middleware, and it is what makes the metrics endpoint separable without inventing auth for it.
- **No alerting** → deferred deliberately; thresholds set before a baseline exists are noise, and the metrics are the prerequisite.
- **`AsyncLocalStorage` context can be lost across some boundaries** → a missing identifier degrades to a per-line generated one rather than an error, and the enqueue path copies the identifier into the payload explicitly rather than relying on propagation.
