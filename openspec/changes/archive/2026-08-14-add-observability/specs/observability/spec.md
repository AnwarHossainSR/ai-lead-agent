## Purpose

Provides correlated structured logs with redaction applied at the writer rather than at each call site, metrics covering the failure modes this pipeline actually has, error reporting that carries no credential or personal data, and liveness and readiness reported separately from dependency health.

## ADDED Requirements

### Requirement: Redaction happens at the writer, not the call site

The system SHALL apply redaction inside the logger to every value it writes, replacing connection strings, API keys, session identifiers, passwords, email addresses and captured page content. A caller SHALL NOT be required to redact before logging, and a value passed accidentally SHALL still be redacted.

#### Scenario: A connection string passed to a log call is redacted

- **WHEN** a log call is made with a connection string in its payload
- **THEN** the written line contains a redaction marker and no connection string

#### Scenario: An API key is redacted wherever it appears

- **WHEN** a log payload contains an API key at any depth
- **THEN** the written line contains no part of the key

#### Scenario: An email address is redacted

- **WHEN** a log payload contains an email address
- **THEN** the written line contains a redaction marker instead

#### Scenario: An error object carrying a credential is redacted

- **WHEN** an error whose message contains a credential is logged
- **THEN** the written line contains no credential

#### Scenario: Redaction does not remove the diagnostic value

- **WHEN** a redacted line is written
- **THEN** it still carries the event, the stage, the outcome and the correlation identifier

### Requirement: Every line carries a correlation identifier

The system SHALL attach a correlation identifier to every log line emitted while handling one request or one job, SHALL propagate it from an inbound header when supplied, and SHALL carry it onto work enqueued during that handling.

#### Scenario: Lines from one request share an identifier

- **WHEN** a request produces several log lines
- **THEN** every line carries the same correlation identifier

#### Scenario: An inbound identifier is adopted

- **WHEN** a request supplies a correlation identifier header
- **THEN** that identifier is used and returned in the response

#### Scenario: Enqueued work inherits the identifier

- **WHEN** handling a request enqueues a job
- **THEN** lines emitted while processing that job carry the originating identifier

#### Scenario: A job without an origin gets its own

- **WHEN** a scheduled job runs with no originating request
- **THEN** it is assigned a correlation identifier and its lines carry it

### Requirement: Logs are structured outside development

The system SHALL emit one machine-parseable object per line outside development, each carrying at least the time, level, event, correlation identifier and process role. Development output MAY be human-readable.

#### Scenario: Output is parseable outside development

- **WHEN** the process runs outside development
- **THEN** every line emitted is a parseable object carrying the required fields

#### Scenario: The process role is identified

- **WHEN** the API and the worker both emit lines
- **THEN** each line identifies which process produced it

### Requirement: Metrics cover the pipeline's real failure modes

The system SHALL record per-stage outcome counts, per-source block counts, model spend and token usage, queue depth and job durations, HTTP status counts and database pool saturation, and SHALL expose them in a standard text format.

#### Scenario: Stage outcomes are counted

- **WHEN** a pipeline stage completes with any outcome
- **THEN** a counter for that stage and outcome is incremented

#### Scenario: Blocked sources are countable

- **WHEN** a source blocks a request
- **THEN** a counter for that source and outcome is incremented

#### Scenario: Model spend is recorded

- **WHEN** a model call completes
- **THEN** its tokens and estimated cost are recorded against the prompt and model

#### Scenario: Metrics are exposed in a standard format

- **WHEN** the metrics endpoint is requested
- **THEN** it responds with the recorded metrics in a standard text format

### Requirement: The metrics endpoint is not exposed with the application

The system SHALL serve metrics on a separately configured port, distinct from the port serving the application, and the application's own port SHALL NOT serve metrics.

#### Scenario: Metrics are not on the application port

- **WHEN** the metrics path is requested on the application port
- **THEN** it is not served

#### Scenario: Metrics are served on their own port

- **WHEN** the metrics path is requested on the configured metrics port
- **THEN** the metrics are returned

#### Scenario: Metrics carry no credential or personal data

- **WHEN** the metrics output is inspected
- **THEN** it contains no credential, no email address and no page content

### Requirement: Unhandled failures are reported once, redacted

The system SHALL capture unhandled exceptions and unhandled promise rejections in both processes, report each once with its correlation identifier, and apply the same redaction as the logger. Reporting SHALL be a no-op when no destination is configured, and SHALL never prevent the process from shutting down.

#### Scenario: An unhandled rejection is reported

- **WHEN** a promise rejection goes unhandled
- **THEN** it is reported once with its correlation identifier

#### Scenario: A report carries no credential

- **WHEN** a captured error's message contains a credential
- **THEN** the report contains no credential

#### Scenario: Reporting is optional

- **WHEN** no reporting destination is configured
- **THEN** the process runs normally and reporting does nothing

#### Scenario: A failing reporter does not block shutdown

- **WHEN** the reporting destination is unreachable during shutdown
- **THEN** the process still exits

### Requirement: Liveness and readiness are separate from dependency health

The system SHALL expose a liveness endpoint reporting only that the process is running, and a readiness endpoint reporting whether it can serve work. The existing health endpoint SHALL continue to report dependency reachability. Liveness SHALL NOT fail because a dependency is unreachable.

#### Scenario: Liveness succeeds with a dependency down

- **WHEN** the liveness endpoint is called while the database is unreachable
- **THEN** it responds successfully

#### Scenario: Readiness fails with a dependency down

- **WHEN** the readiness endpoint is called while the database is unreachable
- **THEN** it responds with a failure status

#### Scenario: Readiness fails during shutdown

- **WHEN** the process has begun shutting down
- **THEN** readiness responds with a failure status while liveness still succeeds

#### Scenario: Health still reports dependencies

- **WHEN** the health endpoint is called
- **THEN** it reports each dependency's reachability as before
