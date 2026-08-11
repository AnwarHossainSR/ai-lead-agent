## ADDED Requirements

### Requirement: An analysis records its outcome and the reason for it

The system SHALL record on each website analysis an outcome distinguishing completed, partially completed, blocked, skipped and failed, together with a reason where the outcome is not completed, the URL actually analysed after redirects, and the HTTP status observed. An unrecognised outcome SHALL be rejected.

#### Scenario: An outcome and reason are stored

- **WHEN** an analysis ends without completing
- **THEN** the row carries a non-completed outcome and a reason

#### Scenario: An unrecognised outcome is refused

- **WHEN** a write attempts to store an outcome outside the defined set
- **THEN** the database rejects it

#### Scenario: A non-completed outcome requires a reason

- **WHEN** a write attempts to store a blocked, skipped or failed outcome with no reason
- **THEN** the database rejects it

### Requirement: A non-completed analysis carries no scores

The system SHALL reject any analysis row that carries a quality score together with an outcome of blocked, skipped or failed. A score is a measurement, and an analysis that did not complete its audit has not measured anything.

#### Scenario: A failed analysis with a score is refused

- **WHEN** a write attempts to store a failed analysis carrying a performance score
- **THEN** the database rejects it

#### Scenario: A completed analysis may carry scores or none

- **WHEN** a completed analysis is stored with some scores measured and others not
- **THEN** the write succeeds

### Requirement: Capture artifacts are referenced, not embedded

The system SHALL store screenshots and raw audit reports outside the database and SHALL record their location on the analysis row as a path relative to a configured root. The system SHALL NOT store binary artifact content in the database.

#### Scenario: Artifact paths are stored

- **WHEN** an analysis captures screenshots and an audit report
- **THEN** the row records their relative paths

#### Scenario: An absolute path is refused

- **WHEN** a write attempts to store an artifact location that is an absolute path or escapes the configured root
- **THEN** the write is rejected

#### Scenario: A failed capture stores no artifact path

- **WHEN** an analysis captures nothing
- **THEN** the row carries no artifact paths rather than paths to files that do not exist

### Requirement: Only one analysis may be in progress per company

The system SHALL prevent two analyses being in progress for the same company at the same time, and SHALL surface the refusal as a named condition rather than an unhandled database error.

#### Scenario: A second concurrent analysis is refused

- **WHEN** an analysis is started for a company that already has one in progress
- **THEN** the second is refused naming the in-progress analysis

#### Scenario: A finished analysis frees the company

- **WHEN** an in-progress analysis reaches any terminal outcome
- **THEN** a new analysis may be started for that company

### Requirement: Analyses are queryable by staleness

The system SHALL support listing companies whose most recent completed analysis is older than a given moment, or which have never been analysed, using an index rather than a full scan.

#### Scenario: Stale companies are listed

- **WHEN** companies are queried for a most recent completed analysis older than a given moment
- **THEN** those companies are returned

#### Scenario: Never-analysed companies are included

- **WHEN** the staleness query is run
- **THEN** companies with no completed analysis appear in the result
