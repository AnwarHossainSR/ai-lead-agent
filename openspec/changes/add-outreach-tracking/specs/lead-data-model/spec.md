## ADDED Requirements

### Requirement: Responses are persisted against the message they answer

The system SHALL persist one record per recorded response carrying the outreach record it answers, the response kind, the time it arrived, its text where supplied, the classification proposed, the category confirmed, and the model invocation where classification was involved. A response whose time precedes its message's send time SHALL be rejected.

#### Scenario: A response is stored with its kind and time

- **WHEN** a response is recorded
- **THEN** a row exists carrying the outreach record, the kind and the arrival time

#### Scenario: A response before the send is refused

- **WHEN** a write attempts to store a response earlier than the message's send time
- **THEN** the database rejects it

#### Scenario: A classified response references its invocation

- **WHEN** a response was classified by a model
- **THEN** the row references the invocation that classified it

#### Scenario: An unrecognised response kind is refused

- **WHEN** a write attempts to store a response kind outside the defined set
- **THEN** the database rejects it

#### Scenario: Deleting an outreach record removes its responses

- **WHEN** an outreach record is deleted
- **THEN** its responses are deleted with it

### Requirement: The send record carries how and when a person sent it

The system SHALL record on a sent outreach record the means by which the person sent it and the time they state they sent it, and SHALL reject a send time earlier than the approval time. The existing constraints preventing a sent state without an approval SHALL continue to apply.

#### Scenario: A send records its means

- **WHEN** a send is recorded
- **THEN** the row carries the means and the stated send time

#### Scenario: A send without an approval is still refused

- **WHEN** a write attempts to mark a record sent with no approval timestamp
- **THEN** the database rejects it

#### Scenario: A send before its approval is still refused

- **WHEN** a write attempts to store a send time earlier than the approval time
- **THEN** the database rejects it

### Requirement: Do-not-contact state is persisted and enforced at the database

The system SHALL persist a do-not-contact marker with the time it was set and the reason, on both companies and contacts. The system SHALL reject the creation of an outreach record for a company or contact carrying the marker.

#### Scenario: The marker is stored with its reason and time

- **WHEN** a company or contact is marked as not to be contacted
- **THEN** the row carries the marker, the time and the reason

#### Scenario: An outreach record for a marked contact is refused

- **WHEN** a write attempts to create an outreach record for a marked contact
- **THEN** the database rejects it

#### Scenario: An outreach record for a marked company is refused

- **WHEN** a write attempts to create an outreach record for a marked company
- **THEN** the database rejects it

#### Scenario: A blank reason is refused

- **WHEN** a write attempts to set the marker with a blank reason
- **THEN** the database rejects it
