## Purpose

Runs the platform outside a developer's machine — reproducible container images, infrastructure defined as reviewable code, secrets read from a managed store rather than the environment, artifacts in object storage, migrations as a gated step, and a deployment that verifies readiness and rolls back rather than leaving a broken version serving.

## ADDED Requirements

### Requirement: Images are reproducible and carry no secret

The system SHALL build each application into a container image from the repository alone, pinned to explicit base image versions, running as a non-root user, containing no build toolchain, no source, and no secret in any layer. Building the same commit SHALL produce a functionally identical image.

#### Scenario: An image runs as a non-root user

- **WHEN** a built image is inspected
- **THEN** its default user is not root

#### Scenario: No secret is present in any layer

- **WHEN** every layer of a built image is inspected
- **THEN** no secret value, environment file or credential is present

#### Scenario: The final image carries no build toolchain

- **WHEN** a built image is inspected
- **THEN** it contains no compiler, package manager cache or source directory

#### Scenario: The same commit builds the same image

- **WHEN** the same commit is built twice
- **THEN** the resulting images are functionally identical

### Requirement: Infrastructure is defined as reviewable code

The system SHALL define every deployed resource — database, cache, object storage, container runtime, networking and secrets — as code in the repository. A change to deployed infrastructure SHALL be a change to that code, reviewable before it is applied, and applying it SHALL report what will change before changing it.

#### Scenario: Every resource is defined in the repository

- **WHEN** the deployed resources are compared against the repository definitions
- **THEN** every resource is defined there

#### Scenario: A change is previewed before it is applied

- **WHEN** an infrastructure change is applied
- **THEN** the additions, changes and destructions are reported before anything is changed

#### Scenario: A destructive change is not applied silently

- **WHEN** an infrastructure change would destroy a data-bearing resource
- **THEN** it requires explicit confirmation

### Requirement: The database and cache are private

The system SHALL place the database and the cache on a private network reachable only from the application's own runtime, SHALL NOT expose either to the public internet, and SHALL require encrypted connections to both.

#### Scenario: The database is not publicly reachable

- **WHEN** a connection to the database is attempted from outside the application network
- **THEN** it does not connect

#### Scenario: The cache is not publicly reachable

- **WHEN** a connection to the cache is attempted from outside the application network
- **THEN** it does not connect

#### Scenario: Connections are encrypted

- **WHEN** the application connects to the database or the cache
- **THEN** the connection is encrypted

#### Scenario: The database has automated backups

- **WHEN** the database configuration is inspected
- **THEN** automated backups are enabled with a defined retention period

### Requirement: Secrets come from a managed store, never the environment definition

The system SHALL read every secret from a managed secret store at startup. A secret SHALL NOT appear in the deployment definition, in an image, in the repository, in a build log, or in any application output. Rotating a secret SHALL NOT require rebuilding an image.

#### Scenario: No secret is in the deployment definition

- **WHEN** the deployment definition is inspected
- **THEN** it contains references to secrets, not their values

#### Scenario: A missing secret aborts startup

- **WHEN** a process starts with a required secret absent from the store
- **THEN** startup aborts naming the secret and exits non-zero

#### Scenario: Rotation needs no rebuild

- **WHEN** a secret is rotated in the store and the processes are restarted
- **THEN** they use the new value with no image rebuild

#### Scenario: Secrets do not reach build logs

- **WHEN** the build logs are inspected
- **THEN** no secret value appears

### Requirement: Artifacts are stored through a configured driver

The system SHALL read and write analysis artifacts through a storage driver selected by configuration, providing a local filesystem driver for development and an object storage driver for deployment. Application code SHALL NOT depend on which driver is configured, and a deployed process SHALL NOT write artifacts to a container's local filesystem.

#### Scenario: The same code works with either driver

- **WHEN** an analysis runs with the local driver and with the object storage driver
- **THEN** the artifacts are written and readable in both cases with no code change

#### Scenario: A deployed process does not use local storage

- **WHEN** a deployed process writes an artifact
- **THEN** it is written to object storage and not to the container filesystem

#### Scenario: Artifacts survive a restart

- **WHEN** a deployed process is replaced
- **THEN** artifacts written before the replacement remain readable

#### Scenario: An unreachable store fails the analysis honestly

- **WHEN** the artifact store cannot be written to
- **THEN** the analysis records a failure with that reason rather than reporting success

### Requirement: Migrations run as a gated step, never on boot

The system SHALL run migrations as a separate task before a new version begins serving, SHALL NOT run them automatically when an application process starts, and SHALL stop the deployment when a migration fails, leaving the previous version serving.

#### Scenario: An application process does not migrate

- **WHEN** an application process starts against a database with pending migrations
- **THEN** it does not apply them

#### Scenario: A failed migration stops the deployment

- **WHEN** the migration task fails
- **THEN** the new version is not deployed
- **AND** the previous version continues serving

#### Scenario: Migrations complete before the new version serves

- **WHEN** a deployment succeeds
- **THEN** the migration task completed before the new version began serving

### Requirement: A deployment verifies readiness and rolls back

The system SHALL deploy only after every existing check has passed, SHALL verify the new version reports ready before directing work to it, and SHALL roll back to the previous version when readiness is not reached within a bounded time.

#### Scenario: A failing check blocks deployment

- **WHEN** lint, typecheck, test or build fails
- **THEN** no deployment occurs

#### Scenario: Readiness is verified before traffic

- **WHEN** a new version is deployed
- **THEN** work is directed to it only after it reports ready

#### Scenario: A version that never becomes ready is rolled back

- **WHEN** a new version does not report ready within the bounded time
- **THEN** the previous version is restored and the deployment is reported as failed

#### Scenario: A rollback is reported, not silent

- **WHEN** a rollback occurs
- **THEN** the workflow reports a failing status naming the reason

### Requirement: Deployment credentials are scoped and not long-lived

The system SHALL authenticate the deployment workflow using short-lived, scoped credentials rather than a long-lived key stored in the repository or its settings, and those credentials SHALL permit only the actions deployment requires.

#### Scenario: No long-lived deployment key is stored

- **WHEN** the workflow configuration is inspected
- **THEN** it contains no long-lived provider access key

#### Scenario: Deployment credentials are scoped

- **WHEN** the deployment role's permissions are inspected
- **THEN** they permit only the actions the deployment performs
