## ADDED Requirements

### Requirement: The worker runs alongside the applications in development

The system SHALL start the worker process together with the API and the web application from the single development command, and SHALL report the queues it is consuming when it starts. The worker SHALL shut down cleanly on interrupt, finishing or releasing its active jobs rather than abandoning them.

#### Scenario: Development starts the worker

- **WHEN** the development command is run
- **THEN** the API, the web application and the worker all start
- **AND** the worker reports the queues it is consuming

#### Scenario: The worker shuts down cleanly

- **WHEN** the worker receives an interrupt while processing a job
- **THEN** it stops accepting new jobs and releases or finishes the active one before exiting

#### Scenario: A worker with no Redis reports clearly

- **WHEN** the worker starts with Redis unreachable
- **THEN** it reports the queue as unreachable with an actionable message rather than a raw driver error

### Requirement: Worker configuration is declared and validated

The system SHALL declare every worker and queue environment variable in the committed example file with a placeholder and a comment, and SHALL validate them at startup with a message naming the variable and its purpose on failure.

#### Scenario: A missing worker variable aborts startup

- **WHEN** the worker starts with a required variable unset
- **THEN** startup aborts naming the variable and what it is for
- **AND** the process exits non-zero

#### Scenario: The example file lists the worker variables

- **WHEN** the worker's variables are compared against the committed example file
- **THEN** every one is present with a placeholder and a comment

### Requirement: Continuous integration exercises the queue

The system SHALL make Redis available to the test job and SHALL run the background job tests against it, so queue behaviour is verified by the same workflow as everything else.

#### Scenario: The workflow provides Redis to the job tests

- **WHEN** the workflow runs
- **THEN** Redis is available and the background job tests run against it

#### Scenario: A failing job test fails the workflow

- **WHEN** a background job test fails
- **THEN** the workflow reports a failing status
