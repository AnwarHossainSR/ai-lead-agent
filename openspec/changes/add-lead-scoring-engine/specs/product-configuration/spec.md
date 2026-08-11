## ADDED Requirements

### Requirement: Scoring weights carry a version

The system SHALL declare a version alongside the scoring weights and SHALL require that version to be incremented whenever a weight changes. Scores record the version they were computed with, so a weight change makes existing scores identifiably stale rather than silently incomparable.

#### Scenario: The version is available to scoring

- **WHEN** the configured weights are read
- **THEN** their version is available with them

#### Scenario: A changed weight with an unchanged version fails

- **WHEN** the configured weights differ from the recorded fingerprint for their version
- **THEN** loading the configuration fails stating that the version must be incremented

### Requirement: Every configured weight has an implemented scorer

The system SHALL validate at load that the set of configured scoring components exactly matches the set of implemented scorers. A configured weight with no scorer, or a scorer with no configured weight, SHALL fail immediately rather than silently contributing nothing.

#### Scenario: A weight without a scorer fails at load

- **WHEN** a scoring component is configured with no corresponding scorer
- **THEN** loading fails naming the component

#### Scenario: A scorer without a weight fails at load

- **WHEN** a scorer exists for a component that is not configured
- **THEN** loading fails naming the scorer

### Requirement: Per-component scoring rules are configuration

The system SHALL declare each component's scoring rule as validated configuration — the thresholds, bands or point allocations it uses — so tuning a component is a configuration edit rather than a code change. Rules SHALL be validated at load for coverage and ordering, and a rule that cannot produce a value in 0 to 100 SHALL fail.

#### Scenario: Overlapping bands fail at load

- **WHEN** a component's rule declares overlapping bands
- **THEN** loading fails naming the component and the overlap

#### Scenario: A rule that cannot reach a valid value fails at load

- **WHEN** a component's rule can produce a value outside 0 to 100
- **THEN** loading fails naming the component

#### Scenario: Tuning a threshold needs no code change

- **WHEN** a component's threshold is changed in configuration and the weight version is incremented
- **THEN** rescoring produces the new values with no change to scoring logic
