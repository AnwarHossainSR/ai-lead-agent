## ADDED Requirements

### Requirement: Discovery runs are persisted with their outcome

The system SHALL persist one record per discovery run carrying the requested country, city and industry, the time it started and finished, its outcome, and the limits it was bounded by. Outcomes SHALL distinguish a completed run, a partially completed run, a run that reached a limit, and a failed run.

#### Scenario: A run is stored with its request and outcome

- **WHEN** a discovery run finishes
- **THEN** a row exists carrying the requested territory, industry, start and finish times, and an outcome

#### Scenario: An unrecognised outcome is refused

- **WHEN** a write attempts to store a run outcome outside the defined set
- **THEN** the database rejects it

#### Scenario: A finished run cannot finish before it started

- **WHEN** a write attempts to store a finish time earlier than the start time
- **THEN** the database rejects it

### Requirement: Per-source results are persisted separately from the run

The system SHALL persist, for each source consulted by a run, the candidates returned, stored, deduplicated and rejected, and the source's own outcome including skipped and blocked. Rejection reasons SHALL be persisted in a form that can be counted by reason.

#### Scenario: Each consulted source has its own row

- **WHEN** a run consults three sources
- **THEN** three per-source rows exist referencing that run

#### Scenario: Counts cannot be negative

- **WHEN** a write attempts to store a negative candidate count
- **THEN** the database rejects it

#### Scenario: Deleting a run removes its per-source rows

- **WHEN** a discovery run is deleted
- **THEN** its per-source rows are deleted with it

### Requirement: A company records the run that first found it

The system SHALL record on each company the discovery run that created it, where one exists. Deleting a discovery run SHALL NOT delete the companies it found.

#### Scenario: A discovered company references its run

- **WHEN** a company is created by a discovery run
- **THEN** the company row references that run

#### Scenario: Companies survive their run's deletion

- **WHEN** a discovery run is deleted
- **THEN** the companies it found remain, with no run reference

#### Scenario: A manually created company needs no run

- **WHEN** a company is created outside any run
- **THEN** the company is stored with no run reference

### Requirement: A company records every source that found it

The system SHALL record each distinct source that has produced a given company, with the URL it was found at and when. Rediscovery by an already-recorded source SHALL update the time rather than add a duplicate row.

#### Scenario: A second source is recorded against an existing company

- **WHEN** a second source produces a company already stored
- **THEN** the company has two source records

#### Scenario: Rediscovery by the same source is not duplicated

- **WHEN** the same source produces the same company twice
- **THEN** one source record exists for that pair, with an updated time
