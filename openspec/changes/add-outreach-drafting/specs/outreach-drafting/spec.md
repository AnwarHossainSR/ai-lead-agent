## Purpose

Generates a personalized outreach message for one lead on one channel from facts the platform already holds, requires every specific claim to cite one of them, and routes every draft through an explicit per-message human approval that a later edit revokes — with nothing in the capability able to send.

## ADDED Requirements

### Requirement: Nothing in this capability can send a message

The system SHALL contain no transport, client, scheduler, credential or endpoint capable of transmitting a message by any channel. A draft SHALL reach a recipient only through a person acting outside the platform.

#### Scenario: No sending mechanism exists

- **WHEN** the capability's code, configuration and environment schema are inspected
- **THEN** they contain no email, messaging or social client, no sending credential, and no endpoint that transmits

#### Scenario: Approval does not transmit

- **WHEN** a draft is approved
- **THEN** no message is transmitted and no external service is contacted

#### Scenario: There is no scheduled send

- **WHEN** the capability is inspected for scheduling
- **THEN** no mechanism exists to transmit a message at a later time

### Requirement: A draft is generated only from stored facts, and cites them

The system SHALL supply the model with the lead's research summary, its opportunities and their citations, the selected contact, and the configured service catalogue. Every specific claim about the recipient's business SHALL cite a supplied fact, verified after parsing against the actual input set. A draft containing an unsupported claim SHALL be rejected in full.

#### Scenario: A grounded draft is accepted

- **WHEN** every specific claim in the generated draft cites a supplied fact
- **THEN** the draft is stored

#### Scenario: An unsupported claim rejects the whole draft

- **WHEN** a generated draft contains a claim citing nothing or citing an identifier not supplied
- **THEN** the draft is rejected in full and the rejection is recorded

#### Scenario: A draft is not partially salvaged

- **WHEN** a draft contains both supported and unsupported claims
- **THEN** no partial draft is stored

#### Scenario: A lead with no summary cannot be drafted for

- **WHEN** drafting is requested for a lead with no current research summary
- **THEN** the request is refused naming the reason and no model call is made

### Requirement: Prohibited content is rejected

The system SHALL reject a draft that asserts facts the platform does not hold about the recipient, promises a specific outcome or result, claims a prior relationship, meeting or referral that did not occur, or states a price or timeline. The check SHALL be applied by the system to the parsed output.

#### Scenario: An invented fact rejects the draft

- **WHEN** a draft asserts something about the recipient's business that no supplied fact supports
- **THEN** the draft is rejected and the reason recorded

#### Scenario: A promised outcome rejects the draft

- **WHEN** a draft promises a specific improvement, result or figure
- **THEN** the draft is rejected and the reason recorded

#### Scenario: A claimed prior relationship rejects the draft

- **WHEN** a draft refers to a previous conversation, meeting, referral or introduction
- **THEN** the draft is rejected and the reason recorded

#### Scenario: A stated price rejects the draft

- **WHEN** a draft states a price, rate or delivery timeline
- **THEN** the draft is rejected and the reason recorded

### Requirement: Drafting requires a contactable recipient on a configured channel

The system SHALL refuse to draft for a contact that has no contact detail for the requested channel, or whose detail has no source URL. The channel SHALL be one the configuration defines, and the configuration SHALL continue to declare automated sending as not permitted for every channel.

#### Scenario: A contact with a sourced address can be drafted for

- **WHEN** drafting is requested for a contact whose email carries a source URL
- **THEN** drafting proceeds

#### Scenario: A contact with no address for the channel is refused

- **WHEN** drafting is requested on a channel for which the contact has no detail
- **THEN** the request is refused naming the channel and the missing detail

#### Scenario: A contact detail without a source is refused

- **WHEN** drafting is requested for a contact detail carrying no source URL
- **THEN** the request is refused

#### Scenario: An unknown channel is refused

- **WHEN** drafting is requested on a channel that is not configured
- **THEN** the request is refused naming the configured channels

### Requirement: A draft is never created already approved

The system SHALL create every draft in the draft state. No parameter, field or path SHALL allow a record to be created in an approved or sent state, or to carry an approval timestamp at creation.

#### Scenario: A new draft is unapproved

- **WHEN** a draft is created
- **THEN** its state is draft with no approval timestamp

#### Scenario: There is no parameter to pre-approve

- **WHEN** the draft creation interface is inspected
- **THEN** it has no status, approval or sent parameter

### Requirement: Approval is an explicit act on one message

The system SHALL require a distinct approval action per message, performed by a person, and SHALL record the time of approval from the server rather than from the caller. The system SHALL provide no action that approves more than one message at a time.

#### Scenario: A draft is approved individually

- **WHEN** a person approves a draft
- **THEN** the record becomes approved with a server-recorded approval time

#### Scenario: A caller-supplied approval time is ignored

- **WHEN** an approval request supplies an approval timestamp
- **THEN** the stored approval time is the server's

#### Scenario: There is no bulk approval

- **WHEN** the approval interface is inspected
- **THEN** it accepts exactly one message per call

#### Scenario: Rejection records a reason

- **WHEN** a person rejects a draft
- **THEN** the record carries the rejection and its stated reason

### Requirement: Editing an approved message revokes its approval

The system SHALL clear the approval of any message whose subject or body is changed after approval, returning it to the draft state and recording that the approval was revoked by an edit.

#### Scenario: An edit after approval revokes it

- **WHEN** the body of an approved message is changed
- **THEN** the message returns to the draft state with no approval timestamp
- **AND** the revocation is recorded

#### Scenario: An edit before approval does not revoke anything

- **WHEN** an unapproved draft is edited
- **THEN** it remains a draft and no revocation is recorded

#### Scenario: Approved text and stored text always match

- **WHEN** a message is in the approved state
- **THEN** its stored subject and body are the ones that were approved

### Requirement: A draft records how it was produced

The system SHALL record for every draft the prompt version, the model invocation, the facts it cited, and whether the current text is the generated text or has been edited by a person.

#### Scenario: A generated draft records its provenance

- **WHEN** a draft is generated
- **THEN** it records the prompt version, the invocation and the cited facts

#### Scenario: An edited draft is marked as edited

- **WHEN** a person edits a draft's text
- **THEN** the record marks the text as human-edited and retains the generated original

#### Scenario: The original generated text remains retrievable

- **WHEN** an edited draft is inspected
- **THEN** the text as originally generated is still readable
