## ADDED Requirements

### Requirement: Browser-based analysis is reproducible from setup documentation

The system SHALL pin the browser automation and audit tool versions, SHALL provide a single documented command that installs the browser binaries a fresh clone needs, and SHALL fail with an actionable message when analysis is attempted without them rather than with a raw library error.

#### Scenario: A fresh clone can run the analysis suite

- **WHEN** a contributor follows the setup documentation on a fresh clone
- **THEN** the browser binaries are installed and the website analysis tests pass

#### Scenario: A missing browser is reported clearly

- **WHEN** analysis is attempted with no browser binary installed
- **THEN** the failure names the missing browser and the command that installs it

#### Scenario: CI installs the same browser version

- **WHEN** the workflow runs
- **THEN** it installs the pinned browser version before running the tests that need it

### Requirement: The artifact directory is configured and contained

The system SHALL read the artifact root directory from a validated environment variable, SHALL create it if absent, and SHALL write only within it. The directory SHALL be git-ignored. A configured path that is not writable SHALL abort startup with a message naming the variable and the path.

#### Scenario: A missing artifact directory is created

- **WHEN** the API starts with the configured artifact root absent
- **THEN** the directory is created

#### Scenario: An unwritable artifact directory aborts startup

- **WHEN** the configured artifact root cannot be written to
- **THEN** startup aborts with a message naming the variable and the path
- **AND** the process exits non-zero

#### Scenario: Artifacts are not committed

- **WHEN** the repository is inspected after an analysis has run
- **THEN** no captured screenshot or audit report is tracked by git
