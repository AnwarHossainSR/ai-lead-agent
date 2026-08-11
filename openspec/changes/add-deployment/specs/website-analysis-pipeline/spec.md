## ADDED Requirements

### Requirement: Artifacts are written through a storage driver, not a filesystem path

The system SHALL read and write capture artifacts through a driver selected by configuration rather than by writing to a filesystem path directly. The analysis code SHALL be identical regardless of which driver is configured, and a driver that cannot store an artifact SHALL cause the analysis to record a failure rather than to report success.

#### Scenario: The analysis does not depend on the driver

- **WHEN** an analysis runs under the local driver and under the object storage driver
- **THEN** the same analysis code produces readable artifacts in both cases

#### Scenario: An unwritable store fails the analysis

- **WHEN** the configured driver cannot store an artifact
- **THEN** the analysis records a failure naming that reason
- **AND** it is not recorded as completed

#### Scenario: A stored artifact is readable through the driver

- **WHEN** an artifact stored earlier is requested
- **THEN** the driver returns it without the caller knowing where it is held

#### Scenario: The recorded location is driver-independent

- **WHEN** an artifact location is stored on an analysis
- **THEN** it is a key the driver resolves, not an absolute filesystem path
