## Purpose

Defines the reproducible environment a contributor and the CI system rely on: a single set of workspace commands, containerised backing services, validated environment variables, and a health endpoint that reports whether the API and its dependencies are actually working.
## Requirements
### Requirement: A single command set drives the whole workspace

The system SHALL expose the commands `install`, `dev`, `build`, `lint`, `typecheck`, `test` and `format` from the repository root, each operating across every workspace package. Each command SHALL exit non-zero when any workspace fails. `dev` SHALL start the web and API applications together.

#### Scenario: A fresh clone installs and builds

- **WHEN** a contributor clones the repository and runs install then build on a supported Node and package manager version
- **THEN** both commands complete successfully with no manual per-package steps

#### Scenario: A failing workspace fails the root command

- **WHEN** any workspace has a type error and the root typecheck command is run
- **THEN** the command exits non-zero and the output identifies the failing workspace and file

#### Scenario: Development starts both applications

- **WHEN** the dev command is run
- **THEN** the API and the web application both start and each reports the address it is listening on

#### Scenario: Unsupported toolchain versions are reported clearly

- **WHEN** install is run on a Node or package manager version below the declared minimum
- **THEN** the command fails with a message naming the required version

### Requirement: Backing services run in containers

The system SHALL provide a container definition that starts PostgreSQL and Redis for local development with pinned major versions, named volumes for durable data, and host ports configurable through environment variables. Bringing the stack up SHALL be a single command, and the stack SHALL report each service as healthy before dependent commands are expected to succeed.

#### Scenario: The stack starts and reports healthy

- **WHEN** the container stack is started on a machine with a container runtime available
- **THEN** PostgreSQL and Redis both reach a healthy state
- **AND** each is reachable on its configured host port

#### Scenario: Data survives a restart

- **WHEN** the stack is stopped and started again without removing volumes
- **THEN** previously written database contents are still present

#### Scenario: A port conflict is configurable away

- **WHEN** the configured host port for a service is already in use
- **THEN** changing the port in the environment file and restarting the stack resolves the conflict without editing the container definition

### Requirement: Environment variables are declared, validated and never committed

The system SHALL declare every environment variable it reads in a committed example file carrying placeholder values and a comment describing each variable. Real values SHALL live in a git-ignored local file. The applications SHALL validate environment variables against a schema at startup and SHALL refuse to start when a required variable is missing or malformed. Secrets SHALL NOT appear in committed files, log output, or error messages.

#### Scenario: Startup fails fast on a missing variable

- **WHEN** an application starts with a required environment variable unset
- **THEN** startup aborts with an error naming the variable and what it is for
- **AND** the process exits non-zero

#### Scenario: A malformed variable is rejected

- **WHEN** a variable that must be a URL or a port number is set to a value of the wrong shape
- **THEN** startup aborts with an error naming the variable and the expected shape

#### Scenario: The example file is complete

- **WHEN** the set of variables read by the applications is compared against the committed example file
- **THEN** every variable read is present in the example file

#### Scenario: Secrets are not committed or logged

- **WHEN** the repository and the startup log output are inspected
- **THEN** no real credential value appears in either
- **AND** the git-ignored local environment file is not tracked

### Requirement: The API reports its own and its dependencies' health

The system SHALL expose an unauthenticated health endpoint that reports the API's status together with the reachability of PostgreSQL and Redis. The endpoint SHALL return a success status only when every checked dependency is reachable, and SHALL return a failure status naming the unreachable dependencies otherwise. Each dependency check SHALL be bounded by a timeout so the endpoint always responds.

#### Scenario: All dependencies reachable

- **WHEN** the health endpoint is called while PostgreSQL and Redis are running
- **THEN** it responds with a success status and reports each dependency as reachable

#### Scenario: A dependency is down

- **WHEN** the health endpoint is called while PostgreSQL is stopped
- **THEN** it responds with a failure status
- **AND** the body identifies PostgreSQL as unreachable and Redis as reachable

#### Scenario: A hanging dependency does not hang the endpoint

- **WHEN** a dependency does not respond within the configured check timeout
- **THEN** the endpoint still responds within a bounded time and reports that dependency as unreachable

#### Scenario: Health details leak no credentials

- **WHEN** the health endpoint reports an unreachable dependency
- **THEN** the response contains no connection string, password or other credential

### Requirement: The web application renders a shell backed by live API status

The system SHALL serve a web application containing the site chrome and the operator's working views — leads, companies, the outreach review queue, analytics and pipeline operations — styled with the project's design system. The application SHALL display the API health status obtained from the API, and SHALL render a clear degraded state rather than an error page when the API is unreachable, slow, or returns an error. Every server-side request SHALL be bounded by a timeout, and a panel whose data cannot be loaded SHALL degrade without affecting the rest of the page.

#### Scenario: The shell renders with the API up

- **WHEN** the web application is opened while the API is healthy
- **THEN** the shell renders and displays a healthy API status

#### Scenario: The shell degrades gracefully with the API down

- **WHEN** the web application is opened while the API is not running
- **THEN** the shell still renders and displays an unavailable API status
- **AND** no unhandled error page is shown

#### Scenario: The operator's views are reachable

- **WHEN** the web application is opened while the API is healthy
- **THEN** the leads, companies, outreach review, analytics and operations views are reachable from the navigation

#### Scenario: A slow API does not hang a page

- **WHEN** the API does not respond within the configured timeout
- **THEN** the page renders with the condition displayed

#### Scenario: One failing panel does not take the page down

- **WHEN** one panel's data cannot be loaded
- **THEN** the remaining panels render normally

### Requirement: Continuous integration runs the full check suite

The system SHALL run lint, typecheck, test and build on every push and pull request through an automated workflow. The workflow SHALL provide the backing services that integration tests require, SHALL fail when any check fails, and SHALL NOT deploy anything.

#### Scenario: A pull request is checked

- **WHEN** a pull request is opened
- **THEN** the workflow runs lint, typecheck, test and build
- **AND** the pull request reports a failing status if any of them fail

#### Scenario: Integration tests get their dependencies

- **WHEN** the workflow runs tests that need PostgreSQL or Redis
- **THEN** those services are available to the test job

#### Scenario: No deployment occurs

- **WHEN** the workflow completes successfully on the default branch
- **THEN** nothing is published or deployed to any environment

### Requirement: The repository documents how to run the project

The system SHALL include documentation covering prerequisites, first-time setup, the command set, how to start and stop backing services, how to run migrations and seeds, and how to run the tests. Documentation SHALL describe only functionality that exists in the repository.

#### Scenario: A new contributor gets running from the documentation alone

- **WHEN** a contributor follows the setup documentation from a fresh clone
- **THEN** they reach a state where the API health endpoint reports healthy and the web shell renders

#### Scenario: Documentation does not describe unbuilt features

- **WHEN** the documentation is compared against the repository contents
- **THEN** every command, file path and capability it describes exists

### Requirement: AI provider configuration is declared and validated

The system SHALL declare every AI provider environment variable in the committed example file with a placeholder and an explanatory comment, and SHALL validate them at startup against a schema that names the variable and its purpose on failure. The provider API key SHALL be treated as a secret: it SHALL NOT appear in any committed file, log line, error message or health response.

#### Scenario: A missing API key aborts startup

- **WHEN** the API starts with the provider API key unset
- **THEN** startup aborts with an error naming the variable and what it is for
- **AND** the process exits non-zero

#### Scenario: A malformed spend ceiling is rejected

- **WHEN** the spend ceiling variable is set to a value that is not a positive number
- **THEN** startup aborts with an error naming the variable and the expected shape

#### Scenario: The example file lists the AI variables

- **WHEN** the set of AI variables the applications read is compared against the committed example file
- **THEN** every one is present with a placeholder and a comment

#### Scenario: The key never reaches the logs

- **WHEN** startup output and error output are inspected with the API key set to a recognisable value
- **THEN** that value appears in neither

### Requirement: Authentication configuration is declared, validated and secret

The system SHALL declare every authentication environment variable in the committed example file with a placeholder and a comment, SHALL validate them at startup with a message naming the variable and its purpose on failure, and SHALL refuse to start outside development with a session secret that is missing, short, or equal to the committed placeholder.

#### Scenario: A missing session secret aborts startup

- **WHEN** the API starts with the session secret unset
- **THEN** startup aborts naming the variable and what it is for
- **AND** the process exits non-zero

#### Scenario: The placeholder secret is refused outside development

- **WHEN** the API starts outside development with the session secret equal to the committed placeholder
- **THEN** startup aborts stating that the placeholder may not be used

#### Scenario: The secret never reaches the logs

- **WHEN** startup and error output are inspected with the session secret set to a recognisable value
- **THEN** that value appears in neither

### Requirement: The first account is created by a documented command

The system SHALL provide a documented command that creates an operator account, SHALL refuse to create one with a weak password, and SHALL NOT print the password back.

#### Scenario: The documented command creates an operator

- **WHEN** the account creation command is run with an email and a password
- **THEN** an operator account exists

#### Scenario: A weak password is refused

- **WHEN** the command is run with a password below the configured minimum strength
- **THEN** it refuses stating the requirement and creates nothing

#### Scenario: The command does not echo the password

- **WHEN** the command completes
- **THEN** its output contains no password

### Requirement: The documentation reflects that the applications are protected

The system SHALL update its documentation to describe sign-in, account creation and the two roles, and SHALL remove the statement that the applications are unauthenticated and local-only.

#### Scenario: Setup documentation covers authentication

- **WHEN** the setup documentation is read
- **THEN** it describes creating the first account, signing in, and what each role may do

#### Scenario: The local-only statement is gone

- **WHEN** the documentation is inspected
- **THEN** it no longer states that the applications carry no authentication

### Requirement: The web application is checked for accessibility in CI

The system SHALL run automated accessibility checks against the main views as part of the workflow, and SHALL fail the run when a violation at the configured level is found.

#### Scenario: The workflow runs the accessibility checks

- **WHEN** the workflow runs
- **THEN** the accessibility checks run against the lead list, lead detail and outreach review views

#### Scenario: A violation fails the run

- **WHEN** an accessibility violation at the configured level is introduced
- **THEN** the workflow reports a failing status

### Requirement: The unauthenticated deployment posture is documented

The system SHALL state in its documentation that the web application and the API carry no authentication and are intended to be run locally only, until an authentication capability exists.

#### Scenario: The documentation states the posture

- **WHEN** the setup documentation is read
- **THEN** it states that there is no authentication and that the applications are intended for local use only

### Requirement: Observability configuration is declared and validated

The system SHALL declare every observability environment variable in the committed example file with a placeholder and a comment, and SHALL validate them at startup with a message naming the variable and its purpose on failure. The metrics port SHALL differ from the application port, and a configuration where they match SHALL abort startup.

#### Scenario: A malformed metrics port aborts startup

- **WHEN** the metrics port is set to a value that is not a valid port
- **THEN** startup aborts naming the variable and the expected shape

#### Scenario: A metrics port equal to the application port aborts startup

- **WHEN** the metrics port equals the application port
- **THEN** startup aborts stating that they must differ

#### Scenario: The example file lists the observability variables

- **WHEN** the observability variables the processes read are compared against the committed example file
- **THEN** every one is present with a placeholder and a comment

### Requirement: No credential or personal data appears in any output

The system SHALL ensure that startup output, request output, job output, error output and metrics output contain no connection string, API key, session identifier, password, email address or captured page content. This SHALL be verified by an automated check rather than by inspection.

#### Scenario: An automated check scans real output

- **WHEN** the applications are exercised with recognisable credential and personal data values configured
- **THEN** an automated check confirms none of those values appears in any output

#### Scenario: The check fails when a leak is introduced

- **WHEN** a log call is added that would write a credential
- **THEN** the automated check fails

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

