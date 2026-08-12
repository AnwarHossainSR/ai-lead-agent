## ADDED Requirements

### Requirement: Opportunities are persisted with their citations and their invocation

The system SHALL persist one record per opportunity carrying the company, the analysis run that produced it, the service it maps to, its title, its description, its impact description, a certainty of inferred, the identifiers of the evidence it cites, and a reference to the model invocation that produced it. A record with no citations SHALL be rejected. A record without an invocation reference SHALL be rejected.

#### Scenario: An opportunity is stored with citations and invocation

- **WHEN** an opportunity is stored
- **THEN** the row carries its service, descriptions, cited evidence identifiers and invocation reference

#### Scenario: An opportunity with no citations is refused

- **WHEN** a write attempts to store an opportunity with an empty citation list
- **THEN** the database rejects it

#### Scenario: An opportunity without an invocation is refused

- **WHEN** a write attempts to store an opportunity with no invocation reference
- **THEN** the database rejects it

#### Scenario: An opportunity claiming observation is refused

- **WHEN** a write attempts to store an opportunity with a certainty of observed
- **THEN** the database rejects it

#### Scenario: A blank description is refused

- **WHEN** a write attempts to store an opportunity whose title, description or impact is blank
- **THEN** the database rejects it

### Requirement: Opportunity analysis runs are persisted with their outcome

The system SHALL persist one record per opportunity analysis run carrying the company, the prompt version used, the outcome, the number of opportunities accepted and rejected, and the rejection reasons. Outcomes SHALL distinguish produced opportunities, insufficient evidence, below threshold, and failed.

#### Scenario: A run records its outcome and counts

- **WHEN** an opportunity analysis run finishes
- **THEN** a row exists carrying its outcome, accepted count, rejected count and rejection reasons

#### Scenario: An unrecognised outcome is refused

- **WHEN** a write attempts to store an outcome outside the defined set
- **THEN** the database rejects it

#### Scenario: A produced-opportunities outcome requires at least one opportunity

- **WHEN** a write records a produced-opportunities outcome with an accepted count of zero
- **THEN** the database rejects it

#### Scenario: Deleting a company removes its runs and opportunities

- **WHEN** a company is deleted
- **THEN** its opportunity analysis runs and opportunities are deleted with it

### Requirement: The opportunity schema has no field for a fabricated figure

The persisted opportunity representation SHALL contain no monetary value, percentage, deal size, duration or other quantified estimate of impact.

#### Scenario: The stored shape carries no quantified impact

- **WHEN** the opportunity table and its validation schema are inspected
- **THEN** neither contains a monetary, percentage, duration or deal-size field
