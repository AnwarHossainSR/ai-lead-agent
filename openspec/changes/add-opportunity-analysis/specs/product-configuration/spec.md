## ADDED Requirements

### Requirement: The evidence threshold for analysis is configuration

The system SHALL declare as validated configuration the minimum evidence a company must have before opportunity analysis is attempted — a minimum count of observations and detections, and whether a completed website analysis is required. A company below the threshold SHALL NOT trigger a model call. The threshold SHALL be validated at load, and a non-negative-integer minimum SHALL be required.

#### Scenario: A negative minimum fails at load

- **WHEN** an evidence minimum is configured as a negative number
- **THEN** loading the configuration fails naming the setting

#### Scenario: Raising the threshold needs no code change

- **WHEN** the minimum evidence count is raised in configuration
- **THEN** companies below the new minimum stop triggering analysis, with no change to analysis logic

### Requirement: The opportunity taxonomy is configuration

The system SHALL declare the opportunity categories the model may use as validated configuration, each with a unique identifier, a display name and the configured service it maps to. A category mapping to an unknown service SHALL fail at load. Resolving an unknown category SHALL be refused rather than defaulted.

#### Scenario: A category mapping to an unknown service fails at load

- **WHEN** an opportunity category names a service identifier that is not configured
- **THEN** loading the configuration fails naming the category and the unknown service

#### Scenario: A duplicate category identifier fails at load

- **WHEN** two categories declare the same identifier
- **THEN** loading the configuration fails naming the duplicate

#### Scenario: An unknown category is refused, not defaulted

- **WHEN** a category identifier that is not configured is resolved
- **THEN** the call fails naming the requested identifier and listing the configured ones
