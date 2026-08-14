## ADDED Requirements

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
