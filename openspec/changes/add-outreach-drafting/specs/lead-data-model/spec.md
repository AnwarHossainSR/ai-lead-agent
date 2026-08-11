## ADDED Requirements

### Requirement: Outreach records carry their draft provenance

The system SHALL record on each outreach record the prompt version, the model invocation that generated it, the facts it cited, the generated text as originally produced, and whether the current text has been edited by a person. A generated record without an invocation reference SHALL be rejected.

#### Scenario: A generated draft stores its provenance

- **WHEN** a draft is generated
- **THEN** the row carries the prompt version, invocation, cited facts and the original generated text

#### Scenario: A generated draft without an invocation is refused

- **WHEN** a write attempts to store a generated draft with no invocation reference
- **THEN** the database rejects it

#### Scenario: The original text survives an edit

- **WHEN** a draft's current text is edited
- **THEN** the originally generated text remains stored

#### Scenario: A manually written record needs no invocation

- **WHEN** a record is created as human-authored rather than generated
- **THEN** it is stored with no invocation reference and marked as such

### Requirement: An edit clears an approval

The system SHALL clear the approval timestamp and return the record to the draft state whenever its subject or body changes while it is approved. A record SHALL NOT exist in the approved state with text differing from the text that was approved.

#### Scenario: Editing an approved record clears its approval

- **WHEN** the body of an approved record is updated
- **THEN** the stored record has no approval timestamp and is in the draft state

#### Scenario: An approved record's text matches its approved text

- **WHEN** an approved record is read
- **THEN** its text equals the text recorded at approval

#### Scenario: A direct write leaving an approved record with changed text is refused

- **WHEN** a write attempts to change the text of an approved record without clearing the approval
- **THEN** the database rejects it

### Requirement: Rejections and revocations are recorded

The system SHALL record a rejection with its reason and the time it occurred, and SHALL record when an approval was revoked by an edit. A rejected record SHALL carry a non-blank reason.

#### Scenario: A rejection carries a reason

- **WHEN** a draft is rejected
- **THEN** the record carries the rejection reason and time

#### Scenario: A blank rejection reason is refused

- **WHEN** a write attempts to record a rejection with a blank reason
- **THEN** the database rejects it

#### Scenario: A revocation is recorded

- **WHEN** an approval is revoked by an edit
- **THEN** the record carries the revocation and its time
