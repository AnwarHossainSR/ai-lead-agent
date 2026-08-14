## ADDED Requirements

### Requirement: Score snapshots are persisted with their inputs

The system SHALL persist one snapshot per scoring run carrying the lead, the component values, the total, the priority, the explanation, the weight version, and identifiers of the evidence the score was computed from. Snapshots SHALL accumulate rather than being overwritten. A snapshot whose total does not equal the weighted sum of its components SHALL be rejected.

#### Scenario: A snapshot is stored with its inputs

- **WHEN** a scoring run completes
- **THEN** a snapshot row exists carrying the components, total, priority, explanation, weight version and evidence identifiers

#### Scenario: An inconsistent snapshot is refused

- **WHEN** a write attempts to store a snapshot whose total does not match its weighted components
- **THEN** the database rejects it

#### Scenario: A blank explanation is refused

- **WHEN** a write attempts to store a snapshot with a blank explanation
- **THEN** the database rejects it

#### Scenario: Rescoring accumulates snapshots

- **WHEN** a lead is scored twice
- **THEN** two snapshots exist

#### Scenario: Deleting a lead removes its snapshots

- **WHEN** a lead is deleted
- **THEN** its snapshots are deleted with it

### Requirement: A lead records the weight version it was scored with

The system SHALL record on each lead the weight version used for its current score and the time it was scored. Leads SHALL be listable by a weight version older than the current one without a full scan.

#### Scenario: The weight version is recorded

- **WHEN** a lead is scored
- **THEN** the lead records the weight version and the time

#### Scenario: Stale leads are listed by version

- **WHEN** leads are queried for a weight version older than the current one
- **THEN** they are returned using an index

#### Scenario: A score without a weight version is refused

- **WHEN** a write attempts to store a lead score with no weight version
- **THEN** the database rejects it

### Requirement: Scoring cannot alter a lead's status

The system SHALL prevent a scoring write from changing a lead's status. Status changes SHALL continue to occur only through the controlled transition path.

#### Scenario: A score update leaves the status unchanged

- **WHEN** a lead's score is updated
- **THEN** its status is unchanged

#### Scenario: A scoring write attempting a status change is refused

- **WHEN** a scoring write includes a status value
- **THEN** the write is refused with an error stating that status changes go through the transition path
