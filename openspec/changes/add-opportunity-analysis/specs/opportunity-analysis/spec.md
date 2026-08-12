## Purpose

Interprets a company's observed website evidence into business opportunities matched to the operator's services, requiring every opportunity to cite the evidence it rests on, rejecting unsupported claims rather than storing them, describing impact rather than quantifying it, and treating "not enough evidence" as a result worth recording.

## ADDED Requirements

### Requirement: Analysis sees only evidence gathered about that company

The system SHALL supply the model with the observations, technology detections and configured attributes belonging to the single company being analysed, together with the operator's service catalogue. It SHALL NOT supply data about other companies, and SHALL NOT supply any attribute the platform holds as unknown.

#### Scenario: Only the subject company's evidence is supplied

- **WHEN** analysis runs for a company
- **THEN** the model input contains that company's evidence and no other company's

#### Scenario: Unknown attributes are absent from the input

- **WHEN** a company's size or description is unknown
- **THEN** the model input omits those attributes rather than describing them as unknown values to reason about

#### Scenario: Evidence carries the identifiers needed to cite it

- **WHEN** the model input is built
- **THEN** each observation and detection carries a stable identifier the model can cite

### Requirement: Every opportunity cites the evidence it rests on

The system SHALL reject any opportunity that cites no evidence, and any opportunity citing an identifier that was not present in the input. The check SHALL be performed by the system after parsing, against the actual input set, and SHALL NOT rely on the model having followed an instruction.

#### Scenario: A cited opportunity is accepted

- **WHEN** the model returns an opportunity citing identifiers present in the input
- **THEN** the opportunity is accepted and stored with its citations

#### Scenario: An uncited opportunity is rejected

- **WHEN** the model returns an opportunity citing no evidence
- **THEN** that opportunity is discarded and the rejection is recorded

#### Scenario: A fabricated citation is rejected

- **WHEN** the model returns an opportunity citing an identifier that was not in the input
- **THEN** that opportunity is discarded and the rejection is recorded

#### Scenario: One rejected opportunity does not discard the rest

- **WHEN** a response contains both cited and uncited opportunities
- **THEN** the cited ones are stored and the uncited ones are discarded

### Requirement: Insufficient evidence is a result

The system SHALL provide the model with an explicit way to report that the evidence does not support any opportunity, and SHALL record that outcome distinctly from an analysis that produced opportunities and from one that failed.

#### Scenario: The model reports insufficient evidence

- **WHEN** the evidence does not support any opportunity and the model says so
- **THEN** the analysis is recorded with an insufficient-evidence outcome
- **AND** no opportunities are stored

#### Scenario: Insufficient evidence differs from failure

- **WHEN** an insufficient-evidence result and a failed analysis are compared
- **THEN** the two are distinguishable

#### Scenario: Analysis is not attempted below the evidence threshold

- **WHEN** a company has fewer observations and detections than the configured minimum
- **THEN** analysis is not attempted, no model call is made, and the reason is recorded

### Requirement: Impact is described, never quantified

The system SHALL store the consequence of an opportunity as prose describing what it means for the business. The system SHALL NOT store a monetary value, a percentage improvement, a deal size, a timeline or any other figure attributed to the opportunity, and the output schema SHALL provide no field for one.

#### Scenario: Impact is stored as description

- **WHEN** an opportunity is stored
- **THEN** its impact is a description of the consequence

#### Scenario: There is nowhere to put a fabricated number

- **WHEN** the opportunity output schema is inspected
- **THEN** it contains no monetary, percentage, duration or deal-size field

#### Scenario: A number in the description is not promoted to a value

- **WHEN** the model's description happens to contain a figure
- **THEN** it remains part of the description and is not stored as a structured value

### Requirement: Every opportunity maps to a configured service

The system SHALL require each opportunity to name one of the operator's configured services. An opportunity naming an unknown service SHALL be rejected, and the system SHALL NOT create a service to accommodate it.

#### Scenario: An opportunity naming a configured service is accepted

- **WHEN** an opportunity names a configured service identifier
- **THEN** it is stored against that service

#### Scenario: An opportunity naming an unknown service is rejected

- **WHEN** an opportunity names a service identifier that is not configured
- **THEN** the opportunity is discarded and the rejection is recorded with the unknown value

### Requirement: Opportunities are inferences, traceable to the call that made them

The system SHALL store every opportunity with a certainty of inferred and a reference to the model invocation that produced it. An opportunity SHALL NOT be stored as observed.

#### Scenario: An opportunity is stored as inferred

- **WHEN** an opportunity is stored
- **THEN** its certainty is inferred

#### Scenario: An opportunity references its invocation

- **WHEN** an opportunity is stored
- **THEN** it references the model invocation that produced it

#### Scenario: The reasoning can be reconstructed

- **WHEN** a stored opportunity is inspected
- **THEN** its cited evidence and its invocation are both retrievable

### Requirement: Re-analysis supersedes rather than accumulates

The system SHALL attach opportunities to the analysis run that produced them, and SHALL treat the most recent successful run as current while retaining earlier ones.

#### Scenario: The current opportunities are the latest run's

- **WHEN** a company's current opportunities are requested
- **THEN** those from its most recent successful run are returned

#### Scenario: Earlier runs are retained

- **WHEN** a company is analysed twice
- **THEN** both runs' opportunities remain retrievable

#### Scenario: A later failed run does not hide earlier opportunities

- **WHEN** the most recent run failed and an earlier one succeeded
- **THEN** the earlier run's opportunities are still identifiable as the last successful set
