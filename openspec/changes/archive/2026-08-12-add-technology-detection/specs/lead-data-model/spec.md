## ADDED Requirements

### Requirement: Technology detections are persisted individually with their evidence

The system SHALL persist one record per detected technology per analysis, carrying the fingerprint identifier, the technology identifier, its category, the certainty, the location the evidence was found in, the matched text, and an optional version. A record with a certainty of observed and no matched text SHALL be rejected.

#### Scenario: A detection is stored with its evidence

- **WHEN** a technology is detected
- **THEN** a row exists carrying the fingerprint, technology, category, certainty, evidence location and matched text

#### Scenario: An observed detection without evidence is refused

- **WHEN** a write attempts to store an observed detection with no matched text
- **THEN** the database rejects it

#### Scenario: An inferred detection requires the detection that implied it

- **WHEN** a write attempts to store an inferred detection with no implying detection reference
- **THEN** the database rejects it

#### Scenario: An unrecognised certainty is refused

- **WHEN** a write attempts to store a certainty outside the defined set
- **THEN** the database rejects it

### Requirement: A technology appears at most once per analysis

The system SHALL store at most one detection of a given technology for a given analysis. A second detection of the same technology SHALL replace the stored one only when it upgrades the certainty from inferred to observed.

#### Scenario: A duplicate detection is not stored twice

- **WHEN** the same technology is detected twice within one analysis
- **THEN** one row exists for that technology and analysis

#### Scenario: An observation replaces an implication

- **WHEN** a technology already recorded as inferred is subsequently matched directly within the same analysis
- **THEN** the stored row becomes observed with its own evidence

#### Scenario: An implication does not downgrade an observation

- **WHEN** a technology already recorded as observed is implied by another detection in the same analysis
- **THEN** the stored row remains observed

### Requirement: Detections are removed with their analysis and queryable across companies

The system SHALL delete an analysis's detections when that analysis is deleted, and SHALL support counting companies by detected technology across the most recent completed analysis of each, using an index rather than a full scan.

#### Scenario: Deleting an analysis removes its detections

- **WHEN** a website analysis is deleted
- **THEN** its detection rows are deleted with it

#### Scenario: Companies are countable by technology

- **WHEN** companies are counted by a technology detected in their most recent completed analysis
- **THEN** the query returns the count and is served by an index
