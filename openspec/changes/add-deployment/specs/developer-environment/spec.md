## MODIFIED Requirements

### Requirement: Continuous integration runs the full check suite

The system SHALL run lint, typecheck, test and build on every push and pull request through an automated workflow. The workflow SHALL provide the backing services that integration tests require and SHALL fail when any check fails. A pull request SHALL NOT deploy anything. Deployment SHALL occur only from the default branch, only after every check has passed, and SHALL be reported as a distinct outcome from the checks.

#### Scenario: A pull request is checked

- **WHEN** a pull request is opened
- **THEN** the workflow runs lint, typecheck, test and build
- **AND** the pull request reports a failing status if any of them fail

#### Scenario: Integration tests get their dependencies

- **WHEN** the workflow runs tests that need PostgreSQL or Redis
- **THEN** those services are available to the test job

#### Scenario: A pull request never deploys

- **WHEN** the workflow completes successfully on a pull request
- **THEN** nothing is published or deployed to any environment

#### Scenario: A failing check blocks deployment on the default branch

- **WHEN** any check fails on the default branch
- **THEN** no deployment occurs

#### Scenario: A successful default-branch run deploys and reports it

- **WHEN** every check passes on the default branch
- **THEN** the deployment runs and its outcome is reported separately from the checks

## ADDED Requirements

### Requirement: The deployed environment is documented and reproducible from the repository

The system SHALL document how to deploy, what resources are created, where secrets live, and how to roll back, and SHALL describe only what the repository actually defines.

#### Scenario: Deployment is documented

- **WHEN** the deployment documentation is read
- **THEN** it describes the resources created, where secrets are held, how migrations run and how to roll back

#### Scenario: The documentation matches the repository

- **WHEN** the deployment documentation is compared against the infrastructure definitions
- **THEN** every resource, command and path it names exists

#### Scenario: Local development is unaffected

- **WHEN** a contributor follows the local setup documentation
- **THEN** the local stack still starts with no deployment credentials and no cloud access
