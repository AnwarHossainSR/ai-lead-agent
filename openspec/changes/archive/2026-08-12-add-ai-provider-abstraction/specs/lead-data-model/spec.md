## ADDED Requirements

### Requirement: Model calls are persisted as an audit trail

The system SHALL persist one record per language model call, carrying the prompt name, prompt version, model identifier, input and output token counts, estimated cost, latency, outcome, and the time it occurred. The record SHALL NOT contain the API key. Records SHALL be retained independently of the entities that reference them, so deleting a company does not erase the accounting for work already paid for.

#### Scenario: An invocation is stored with its accounting

- **WHEN** a model call completes
- **THEN** a row exists carrying the prompt name, version, model, input and output token counts, estimated cost, latency and outcome

#### Scenario: An invocation carries no credential

- **WHEN** an invocation row is inspected
- **THEN** it contains no API key and no rendered prompt text

#### Scenario: An unrecognised outcome is refused

- **WHEN** a write attempts to store an outcome outside the defined set
- **THEN** the database rejects it

### Requirement: AI-derived values reference the call that produced them

Any stored value the system derives from a language model SHALL carry a reference to its invocation record. A write that supplies an AI-derived value without such a reference SHALL be rejected, so an inferred fact can always be distinguished from an observed one and traced to its source.

#### Scenario: A derived value carries its invocation

- **WHEN** a value produced by a model call is stored
- **THEN** the stored row references the invocation that produced it

#### Scenario: A derived value without an invocation is refused

- **WHEN** a write supplies an AI-derived value with no invocation reference
- **THEN** the write is rejected naming the missing reference

#### Scenario: Deleting the subject preserves the accounting

- **WHEN** an entity holding AI-derived values is deleted
- **THEN** its invocation records remain
