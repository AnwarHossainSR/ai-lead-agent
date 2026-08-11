## Purpose

Defines the reproducible environment a contributor and the CI system rely on: a single set of workspace commands, containerised backing services, validated environment variables, and a health endpoint that reports whether the API and its dependencies are actually working.

## ADDED Requirements

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

The system SHALL serve a web application shell containing the site chrome and a placeholder dashboard area, styled with the project's design system. The shell SHALL display the API health status obtained from the API, and SHALL render a clear degraded state rather than an error page when the API is unreachable.

#### Scenario: The shell renders with the API up

- **WHEN** the web application is opened while the API is healthy
- **THEN** the shell renders and displays a healthy API status

#### Scenario: The shell degrades gracefully with the API down

- **WHEN** the web application is opened while the API is not running
- **THEN** the shell still renders and displays an unavailable API status
- **AND** no unhandled error page is shown

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
