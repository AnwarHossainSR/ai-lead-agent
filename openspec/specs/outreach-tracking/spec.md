# outreach-tracking Specification

## Purpose
Records what a person actually did with an approved message and what came back, classifies replies with human confirmation before they take effect, advances the lead lifecycle through the existing transition rules, honours an unsubscribe absolutely, and aggregates real outcomes without presenting a small sample as a trend.
## Requirements
### Requirement: A send is recorded, never performed

The system SHALL provide a way to record that a person sent an approved message, capturing when it was sent and by what means. Recording a send SHALL NOT transmit anything. A send SHALL NOT be recordable for a message that is not approved, and the recorded send time SHALL NOT precede the approval.

#### Scenario: A send is recorded for an approved message

- **WHEN** a person records that they sent an approved message
- **THEN** the record moves to sent with the supplied send time and means

#### Scenario: Recording a send transmits nothing

- **WHEN** a send is recorded
- **THEN** no message is transmitted and no external service is contacted

#### Scenario: An unapproved message cannot be recorded as sent

- **WHEN** a send is recorded for a message that is not approved
- **THEN** the request is refused naming the message's state

#### Scenario: A send time before approval is refused

- **WHEN** a send is recorded with a time earlier than the approval time
- **THEN** the request is refused

### Requirement: Responses are recorded against the message they answer

The system SHALL record a response to a sent message carrying its kind, the time it arrived, and its text where supplied. A response SHALL NOT be recordable for a message that was never sent, and its time SHALL NOT precede the send.

#### Scenario: A reply is recorded

- **WHEN** a reply to a sent message is recorded
- **THEN** the response is stored against that message with its time

#### Scenario: A response to an unsent message is refused

- **WHEN** a response is recorded for a message that was never sent
- **THEN** the request is refused

#### Scenario: A response before the send is refused

- **WHEN** a response is recorded with a time earlier than the send time
- **THEN** the request is refused

#### Scenario: No response after the configured interval is recordable

- **WHEN** the configured interval has passed with no response
- **THEN** the message can be recorded as having received no response

### Requirement: A classified reply is proposed, not applied

The system SHALL classify a supplied reply into a configured category and SHALL present that classification, its confidence in the form of the text it relied on, and the status transition it would cause. The transition SHALL take effect only when a person confirms it.

#### Scenario: A classification is proposed with its basis

- **WHEN** a reply is classified
- **THEN** the category, the text it relied on and the proposed status transition are presented

#### Scenario: An unconfirmed classification changes nothing

- **WHEN** a classification is produced and not confirmed
- **THEN** the lead's status is unchanged

#### Scenario: A confirmed classification applies its transition

- **WHEN** a person confirms a proposed classification
- **THEN** the lead's status changes accordingly

#### Scenario: A person can override the proposed category

- **WHEN** a person selects a different category from the configured set
- **THEN** that category's transition is proposed instead

#### Scenario: An unclassifiable reply is left to the person

- **WHEN** the classifier cannot place a reply in a configured category
- **THEN** it reports that outcome rather than choosing the nearest category

### Requirement: Status changes follow the configured transition rules

The system SHALL apply a lead status change only through the configured transition map. An impermissible transition SHALL be refused with an error naming the current status, the requested status and the permitted targets, and SHALL NOT be written.

#### Scenario: A permitted transition is applied

- **WHEN** a confirmed outcome proposes a transition the configuration permits
- **THEN** the lead's status changes

#### Scenario: An impermissible transition is refused

- **WHEN** a confirmed outcome proposes a transition the configuration does not permit
- **THEN** the change is refused naming the current status, the requested status and the permitted targets
- **AND** the lead's status is unchanged

### Requirement: Do not contact is absolute

The system SHALL allow a company or a contact to be marked as not to be contacted, SHALL exclude them from drafting, from outreach listings and from future pipeline runs, and SHALL provide no override, flag or parameter that permits contacting them anyway. An unsubscribe response SHALL set this state.

#### Scenario: An unsubscribe marks the contact

- **WHEN** a response is recorded as an unsubscribe request
- **THEN** the contact is marked as not to be contacted

#### Scenario: A marked contact cannot be drafted for

- **WHEN** drafting is requested for a contact marked as not to be contacted
- **THEN** the request is refused naming the reason
- **AND** no model call is made

#### Scenario: There is no override

- **WHEN** the drafting and outreach interfaces are inspected
- **THEN** they contain no parameter or setting that permits contacting a marked company or contact

#### Scenario: Marked records are excluded from listings

- **WHEN** outreach candidates are listed
- **THEN** marked companies and contacts do not appear

### Requirement: Aggregates report counts alongside rates

The system SHALL compute outcome aggregates from recorded outcomes only, and SHALL return the underlying counts with every rate. It SHALL identify a rate computed from fewer than a configured minimum as being below that minimum rather than presenting it as a comparable figure.

#### Scenario: A rate is returned with its counts

- **WHEN** a response rate is requested
- **THEN** it is returned with the number of messages sent and the number of responses

#### Scenario: A small sample is marked as such

- **WHEN** a rate is computed from fewer than the configured minimum
- **THEN** it is marked as below the reporting minimum

#### Scenario: Aggregates use only recorded outcomes

- **WHEN** aggregates are computed
- **THEN** messages with no recorded outcome are excluded from the numerator and denominator, and their count is reported separately

#### Scenario: No trend is asserted from insufficient data

- **WHEN** the data does not meet the configured minimum
- **THEN** no comparison or trend is reported for that segment

