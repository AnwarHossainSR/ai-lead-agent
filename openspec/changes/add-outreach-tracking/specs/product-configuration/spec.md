## ADDED Requirements

### Requirement: Response categories and their transitions are configuration

The system SHALL declare response categories as validated configuration, each with a unique identifier, a display name and the lead status transition it proposes. A category proposing a transition the lead transition map does not permit SHALL fail at load, so a configured category can never propose an impossible change.

#### Scenario: A category proposing an impermissible transition fails at load

- **WHEN** a response category proposes a status transition the transition map does not permit
- **THEN** loading the configuration fails naming the category and the transition

#### Scenario: A duplicate category identifier fails at load

- **WHEN** two response categories declare the same identifier
- **THEN** loading the configuration fails naming the duplicate

#### Scenario: A category naming an unknown status fails at load

- **WHEN** a response category names a lead status that is not configured
- **THEN** loading the configuration fails naming the category and the unknown status

#### Scenario: An unknown category is refused, not defaulted

- **WHEN** a response category identifier that is not configured is resolved
- **THEN** the call fails naming the requested identifier and listing the configured ones

### Requirement: Reporting thresholds are configuration

The system SHALL declare as validated configuration the interval after which a message may be recorded as having received no response, and the minimum sample size below which a rate is marked as below the reporting minimum. Both SHALL be positive, validated at load.

#### Scenario: A non-positive no-response interval fails at load

- **WHEN** the no-response interval is configured as zero or negative
- **THEN** loading the configuration fails naming the setting

#### Scenario: A non-positive reporting minimum fails at load

- **WHEN** the minimum sample size is configured as zero or negative
- **THEN** loading the configuration fails naming the setting
