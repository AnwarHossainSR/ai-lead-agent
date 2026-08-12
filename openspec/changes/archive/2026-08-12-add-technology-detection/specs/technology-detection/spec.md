## Purpose

Identifies the technologies behind a company's website by matching declared patterns against what the analysis actually captured, recording the matching evidence for every claim, reading a version only where one is stated, and marking anything merely implied as inferred rather than observed.

## ADDED Requirements

### Requirement: A detection is recorded only with reproducible evidence

The system SHALL record a detection only when a declared pattern matched captured content, and SHALL store the fingerprint that matched, the location it matched in, and the matched text. A detection whose evidence cannot be reproduced by re-running the matcher against the same capture SHALL be discarded.

#### Scenario: A matched fingerprint produces a detection with evidence

- **WHEN** a fingerprint pattern matches a response header in the capture
- **THEN** a detection is recorded carrying the fingerprint identifier, the location and the matched text

#### Scenario: An unmatched technology is not recorded

- **WHEN** no declared pattern for a technology matches the capture
- **THEN** no detection for that technology is recorded

#### Scenario: Evidence is reproducible

- **WHEN** the matcher is re-run against the same capture
- **THEN** it produces the same detections with the same evidence

### Requirement: A version is read, never inferred

The system SHALL record a version only when it appears verbatim within the matched evidence. When no version is present, the technology SHALL be recorded with no version. The system SHALL NOT derive a version from release dates, from feature presence, or from any other indirect signal.

#### Scenario: A stated version is recorded

- **WHEN** the matched evidence contains a version string
- **THEN** the detection records that version

#### Scenario: An absent version stays absent

- **WHEN** a technology is detected with no version in the evidence
- **THEN** the detection records no version rather than a guess or a range

#### Scenario: A version is not inferred from behaviour

- **WHEN** captured behaviour is characteristic of a particular release
- **THEN** no version is recorded on that basis alone

### Requirement: Implied technologies are marked inferred

The system SHALL permit a fingerprint to declare technologies it implies. An implied technology SHALL be recorded with a certainty of inferred and a reference to the detection that implied it. A directly matched technology SHALL be recorded with a certainty of observed. An implication SHALL NOT overwrite a direct observation of the same technology.

#### Scenario: An implication is marked inferred

- **WHEN** a detected technology implies another that was not itself matched
- **THEN** the implied technology is recorded as inferred, referencing the detection that implied it

#### Scenario: A direct match outranks an implication

- **WHEN** a technology is both directly matched and implied by another detection
- **THEN** it is recorded once, as observed, with its own evidence

#### Scenario: An implication chain terminates

- **WHEN** fingerprints declare implications that form a cycle
- **THEN** loading the configuration fails naming the cycle

### Requirement: Detection consumes a stored capture and fetches nothing

The system SHALL run detection against the capture recorded by a completed website analysis. It SHALL NOT issue any network request of its own. Detection for an analysis with no usable capture SHALL yield no detections and SHALL state that reason.

#### Scenario: Detection uses the stored capture

- **WHEN** detection runs for a completed analysis
- **THEN** it reads the stored capture and makes no network request

#### Scenario: A failed analysis yields no detections

- **WHEN** detection is requested for an analysis whose capture failed
- **THEN** no detections are recorded
- **AND** the reason is reported

### Requirement: Detections belong to an analysis and are superseded, not mutated

The system SHALL attach detections to the analysis they were derived from. Re-analysing a company SHALL produce a new set attached to the new analysis, leaving the earlier set intact, so a change in a company's stack over time is visible.

#### Scenario: Detections reference their analysis

- **WHEN** detections are recorded
- **THEN** each references the analysis whose capture produced it

#### Scenario: Re-analysis does not erase earlier detections

- **WHEN** a company is analysed a second time
- **THEN** both sets of detections exist, each attached to its own analysis

#### Scenario: The current stack is the latest analysis's detections

- **WHEN** a company's current technologies are requested
- **THEN** the detections from its most recent completed analysis are returned

### Requirement: Detection is deterministic and uses no language model

The system SHALL determine detections solely by evaluating declared patterns against captured content. No part of detection SHALL call a language model.

#### Scenario: The same capture always yields the same detections

- **WHEN** detection runs twice over an identical capture
- **THEN** the two results are identical

#### Scenario: No model is consulted

- **WHEN** detection runs
- **THEN** no language model call is made
