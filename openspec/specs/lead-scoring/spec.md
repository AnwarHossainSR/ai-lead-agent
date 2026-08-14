# lead-scoring Specification

## Purpose
Turns a company's gathered evidence into a weighted, explained, reproducible lead score and priority using deterministic code alone — stating what evidence was missing rather than treating absence as a zero, and recording each score as a snapshot that can be recomputed and compared over time.
## Requirements
### Requirement: Scoring is deterministic and uses no language model

The system SHALL compute every component score, the total, the priority and the explanation in deterministic code. No part of scoring SHALL call a language model. The same evidence and the same configured weights SHALL always produce the same score, priority and explanation.

#### Scenario: The same evidence yields the same score

- **WHEN** a company is scored twice with unchanged evidence and unchanged configuration
- **THEN** the two scores, priorities and explanations are identical

#### Scenario: No model is consulted

- **WHEN** scoring runs
- **THEN** no language model call is made

#### Scenario: A score can be recomputed from its recorded inputs

- **WHEN** a stored score's recorded evidence set is re-scored with the same weight version
- **THEN** the result equals the stored score

### Requirement: The total is the weighted sum of its components

The system SHALL compute each component as a value from 0 to 100, apply the configured weight for that component, and derive the total from those weighted values. The total SHALL NOT be settable independently of its components. A component value outside 0 to 100 SHALL be rejected.

#### Scenario: The total follows from the components

- **WHEN** a lead is scored
- **THEN** the stored total equals the weighted sum of the stored component values

#### Scenario: A component out of range is rejected

- **WHEN** a scorer returns a component value above 100 or below 0
- **THEN** the score is rejected with an error naming the component, the value and the permitted range

#### Scenario: A supplied total is refused

- **WHEN** a caller attempts to supply a total directly
- **THEN** the attempt is refused

#### Scenario: Every configured weight has a scorer

- **WHEN** the configured weights and the implemented scorers are compared at load
- **THEN** a weight with no scorer, or a scorer with no weight, fails immediately

### Requirement: Missing evidence is stated, not scored as zero

The system SHALL distinguish evidence that was gathered and scored poorly from evidence that was never gathered. A component whose inputs are absent SHALL record that the inputs were absent, and the explanation SHALL name what was missing. The system SHALL NOT substitute an average, a neutral value, or a value from another company.

#### Scenario: An absent input is named in the explanation

- **WHEN** a company has no completed website analysis
- **THEN** the explanation states that the website evidence was not gathered

#### Scenario: Absent evidence differs from poor evidence

- **WHEN** a company with no analysis and a company with a poor analysis are scored
- **THEN** their explanations distinguish the two cases

#### Scenario: No value is borrowed from elsewhere

- **WHEN** a component's inputs are absent
- **THEN** no value derived from other companies or from a default profile is used

#### Scenario: Fully absent evidence is refused rather than scored

- **WHEN** a company has none of the evidence any component requires
- **THEN** scoring is refused with a reason and no lead is created

### Requirement: The explanation is derived from the same values as the score

The system SHALL assemble the explanation from the inputs each component actually used, their contribution to the total, and the inputs that were absent. The explanation SHALL be non-empty and SHALL NOT be authored independently of the computation.

#### Scenario: The explanation names each component's contribution

- **WHEN** a lead is scored
- **THEN** the explanation states each component's value, its weight and its contribution

#### Scenario: The explanation cites the evidence used

- **WHEN** a component was driven by specific evidence
- **THEN** the explanation names that evidence

#### Scenario: A blank explanation is refused

- **WHEN** an explanation would be empty or whitespace
- **THEN** the score is refused

### Requirement: Priority follows from the total through configured bands

The system SHALL derive priority from the total using the configured priority bands, and SHALL NOT accept a priority supplied by a caller. A total outside 0 to 100 SHALL be refused rather than classified.

#### Scenario: The priority matches the band

- **WHEN** a lead's total falls within a configured band
- **THEN** the stored priority is that band's priority

#### Scenario: A supplied priority is refused

- **WHEN** a caller attempts to supply a priority directly
- **THEN** the attempt is refused

#### Scenario: A boundary total classifies to the documented band

- **WHEN** a total falls exactly on a band boundary
- **THEN** it classifies to the band the configuration defines for that value

### Requirement: A score is a snapshot that can be compared over time

The system SHALL record each scoring run as a snapshot carrying the component values, the total, the priority, the explanation, the weight version used, and identifiers of the evidence it was computed from. Rescoring SHALL create a new snapshot and retain the previous ones, and the system SHALL be able to report what changed between two snapshots.

#### Scenario: Rescoring retains history

- **WHEN** a company is scored twice
- **THEN** both snapshots exist and the lead reflects the most recent

#### Scenario: A change between snapshots is reportable

- **WHEN** two snapshots for a company are compared
- **THEN** the components that changed, and by how much, are reported

#### Scenario: The evidence behind a snapshot is identifiable

- **WHEN** a snapshot is inspected
- **THEN** the analysis, detections, opportunities and contacts it was computed from are identifiable

### Requirement: Changing the weights makes existing scores stale

The system SHALL record the weight version each score was computed with, SHALL treat a score computed with an earlier version as stale, and SHALL be able to list stale scores. A stale score SHALL remain readable and SHALL be identifiable as stale.

#### Scenario: A score from an older weight version is stale

- **WHEN** the configured weights change and their version is incremented
- **THEN** scores computed with the earlier version are reported as stale

#### Scenario: Stale scores remain readable

- **WHEN** a stale score is read
- **THEN** its values and explanation are returned, marked stale

#### Scenario: Stale scores are listable

- **WHEN** stale scores are requested
- **THEN** they are returned without a full scan

### Requirement: One lead per company, created by scoring

The system SHALL maintain at most one lead per company. Scoring a company that has no lead SHALL create one at the configured initial status; scoring a company that has one SHALL update its score without altering its status.

#### Scenario: The first score creates the lead

- **WHEN** a company with no lead is scored
- **THEN** a lead is created at the configured initial status

#### Scenario: A later score does not reset the status

- **WHEN** a company whose lead has advanced beyond the initial status is rescored
- **THEN** the score changes and the status does not

#### Scenario: A second lead is refused

- **WHEN** a second lead is created for a company that already has one
- **THEN** the write is refused

