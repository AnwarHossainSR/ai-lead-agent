## ADDED Requirements

### Requirement: Research summaries are persisted as generated content

The system SHALL persist one record per generated summary carrying the lead, the structured summary sections, the cited facts, the explicit unknown list, the prompt version, a reference to the model invocation, a marker identifying it as model-generated, and the time it was produced. A summary with no cited facts SHALL be rejected. A summary without an invocation reference SHALL be rejected.

#### Scenario: A summary is stored with its provenance

- **WHEN** a summary is generated
- **THEN** a row exists carrying the sections, citations, unknown list, prompt version and invocation reference

#### Scenario: A summary without citations is refused

- **WHEN** a write attempts to store a summary with no cited facts
- **THEN** the database rejects it

#### Scenario: A summary without an invocation is refused

- **WHEN** a write attempts to store a summary with no invocation reference
- **THEN** the database rejects it

#### Scenario: A summary cannot be stored as human-authored

- **WHEN** a write attempts to store a summary marked as not model-generated
- **THEN** the database rejects it

#### Scenario: Deleting a lead removes its summaries

- **WHEN** a lead is deleted
- **THEN** its summaries are deleted with it

### Requirement: The current summary is unambiguous

The system SHALL identify one current summary per lead, resolved by the most recent successful generation and broken deterministically on a tie, while retaining earlier summaries.

#### Scenario: The most recent summary is current

- **WHEN** a lead has several summaries
- **THEN** the most recently generated one is returned as current

#### Scenario: A tie resolves the same way every time

- **WHEN** two summaries share a generation timestamp and the current one is requested repeatedly
- **THEN** the same one is returned each time
