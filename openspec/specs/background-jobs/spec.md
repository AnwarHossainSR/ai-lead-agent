# background-jobs Specification

## Purpose
Runs the pipeline's stages as retryable, rate-limited, idempotent background work with validated payloads, chains stages automatically up to but never past the human approval gate, and reports the queue's real state including what failed and why.
## Requirements
### Requirement: No job can send an outreach message

The system SHALL define no job type, handler or scheduled task capable of transmitting an outreach message. Automatic chaining SHALL stop at a draft awaiting human approval.

#### Scenario: No sending job type exists

- **WHEN** the registered job types are inspected
- **THEN** none transmits a message by any channel

#### Scenario: The chain stops before approval

- **WHEN** a draft is produced by a background job
- **THEN** no further job is enqueued for that message
- **AND** it waits for a person

#### Scenario: Approval is never automated

- **WHEN** the scheduled and chained job definitions are inspected
- **THEN** none approves an outreach message

### Requirement: Job payloads are validated on both sides of the queue

The system SHALL validate every job payload against a schema when it is enqueued and again when it is processed. A payload failing validation on enqueue SHALL be refused; one failing on processing SHALL fail the job with a reason naming the invalid fields and SHALL NOT be retried.

#### Scenario: An invalid payload is refused at enqueue

- **WHEN** a job is enqueued with a payload that does not satisfy its schema
- **THEN** the enqueue is refused naming the invalid fields
- **AND** nothing is written to the queue

#### Scenario: An invalid payload fails without retrying

- **WHEN** a job is processed with a payload that does not satisfy its schema
- **THEN** the job fails with a reason naming the invalid fields
- **AND** it is not retried

#### Scenario: A payload from an earlier version is handled explicitly

- **WHEN** a queued payload lacks a field a later schema requires
- **THEN** the job fails with a validation reason rather than proceeding with a missing value

### Requirement: Enqueueing the same work twice produces one job

The system SHALL derive a deterministic identifier for each job from its type and its subject, so that enqueueing identical work while it is pending or active does not create a second job.

#### Scenario: A duplicate enqueue is absorbed

- **WHEN** the same work is enqueued twice while the first is pending
- **THEN** one job exists

#### Scenario: Re-enqueueing after completion is permitted

- **WHEN** the same work is enqueued after the earlier job completed
- **THEN** a new job is created

#### Scenario: Different subjects are different jobs

- **WHEN** the same job type is enqueued for two different companies
- **THEN** two jobs exist

### Requirement: A stage with a current result is skipped, not repeated

The system SHALL check before doing work whether the stage already has a current result for its subject, and SHALL complete the job as skipped with that reason rather than repeating expensive work.

#### Scenario: A current result skips the work

- **WHEN** a job runs for a subject whose stage result is current
- **THEN** the job completes as skipped with that reason
- **AND** no browser is launched and no model call is made

#### Scenario: A stale result does not skip

- **WHEN** a job runs for a subject whose stage result is stale
- **THEN** the work is performed

#### Scenario: A forced job ignores currency

- **WHEN** a job is enqueued explicitly marked to force the work
- **THEN** it runs regardless of the current result

### Requirement: Failures are retried by kind, and permanent failures are not

The system SHALL retry transient failures with exponential backoff up to a per-queue attempt limit, and SHALL NOT retry validation failures, refusals by configuration, or failures caused by a blocked source. Every job SHALL be bounded by a timeout.

#### Scenario: A transient failure is retried

- **WHEN** a job fails with a transient error and a later attempt succeeds
- **THEN** the job completes successfully

#### Scenario: A blocked source is not retried

- **WHEN** a job fails because a source blocked the request
- **THEN** it is not retried

#### Scenario: A refusal is not retried

- **WHEN** a job fails because configuration refused it
- **THEN** it is not retried

#### Scenario: A hanging job is bounded

- **WHEN** a job exceeds its configured timeout
- **THEN** it fails with a timeout reason rather than occupying a worker indefinitely

#### Scenario: An exhausted job is retained with its reason

- **WHEN** a job exhausts its attempts
- **THEN** it is retained as failed with the reason of its final attempt

### Requirement: Each queue has its own concurrency and rate limit

The system SHALL configure concurrency and rate limits per queue, so that browser work, model calls and database work do not share a single limit. Per-host politeness limits SHALL continue to apply within a worker.

#### Scenario: Queue limits are independent

- **WHEN** one queue is saturated
- **THEN** other queues continue processing at their own limits

#### Scenario: Host politeness survives concurrency

- **WHEN** several jobs target the same host concurrently
- **THEN** requests to that host remain spaced by the configured interval

#### Scenario: A non-positive concurrency fails at load

- **WHEN** a queue is configured with a concurrency of zero or less
- **THEN** loading the configuration fails naming the queue

### Requirement: Scheduled maintenance runs from the staleness queries

The system SHALL run repeatable scheduled jobs that enqueue work from the staleness queries the pipeline already provides, each on a configurable interval, and each bounded by a maximum number of items per run.

#### Scenario: Stale subjects are enqueued on schedule

- **WHEN** a scheduled maintenance job runs
- **THEN** it enqueues work for subjects the corresponding staleness query returns

#### Scenario: A run is bounded

- **WHEN** more stale subjects exist than the configured maximum per run
- **THEN** at most the configured maximum are enqueued

#### Scenario: A disabled schedule does not run

- **WHEN** a scheduled job is configured as disabled
- **THEN** it is not registered and does not run

### Requirement: The queue's real state is reportable

The system SHALL report per queue the waiting, active, completed, failed and delayed counts, and SHALL list failed jobs with their type, subject, attempts and final failure reason. The health endpoint SHALL include queue reachability.

#### Scenario: Queue counts are reported

- **WHEN** queue state is requested
- **THEN** the waiting, active, completed, failed and delayed counts are returned per queue

#### Scenario: Failed jobs are listed with reasons

- **WHEN** failed jobs are requested
- **THEN** each is returned with its type, subject, attempt count and final failure reason

#### Scenario: A failed job can be retried explicitly

- **WHEN** a failed job is retried by request
- **THEN** it is re-enqueued and its earlier failure remains visible

#### Scenario: Health reports the queue

- **WHEN** the health endpoint is called with the queue unreachable
- **THEN** it responds with a failure status identifying the queue as unreachable

