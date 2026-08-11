## ADDED Requirements

### Requirement: Technology fingerprints are configuration

The system SHALL declare each fingerprint as validated configuration carrying a unique identifier, the technology it identifies, its category, the patterns that indicate it and where each pattern applies, the technologies it implies, and whether a version can be extracted from a match. Adding a fingerprint SHALL be a configuration edit requiring no change to the matcher.

#### Scenario: A duplicate fingerprint identifier fails at load

- **WHEN** two fingerprints declare the same identifier
- **THEN** loading the configuration fails naming the duplicate

#### Scenario: A fingerprint with no patterns fails at load

- **WHEN** a fingerprint declares no patterns
- **THEN** loading the configuration fails naming the fingerprint

#### Scenario: An invalid pattern fails at load

- **WHEN** a fingerprint declares a pattern that is not a valid expression
- **THEN** loading the configuration fails naming the fingerprint and the pattern

#### Scenario: An unknown category fails at load

- **WHEN** a fingerprint declares a category that is not configured
- **THEN** loading the configuration fails naming the fingerprint and the unknown category

#### Scenario: An implication cycle fails at load

- **WHEN** fingerprints declare implications that form a cycle
- **THEN** loading the configuration fails naming the fingerprints in the cycle

#### Scenario: Resolving an unknown fingerprint is refused

- **WHEN** a fingerprint identifier that is not configured is resolved
- **THEN** the call fails naming the requested identifier and listing the configured ones

### Requirement: Fingerprint patterns are bounded so a hostile page cannot stall matching

The system SHALL reject at load time any pattern capable of catastrophic backtracking, and SHALL bound the total time spent matching a single capture. Exceeding the bound SHALL end matching with a recorded reason rather than hanging.

#### Scenario: A pattern with catastrophic backtracking fails at load

- **WHEN** a fingerprint declares a pattern with nested unbounded repetition
- **THEN** loading the configuration fails naming the fingerprint

#### Scenario: Matching is time-bounded

- **WHEN** matching a capture exceeds the configured time bound
- **THEN** matching ends with a recorded reason and the detections found so far are retained
