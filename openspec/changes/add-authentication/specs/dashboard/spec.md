## ADDED Requirements

### Requirement: The interface reflects the signed-in account and its role

The interface SHALL require sign-in before any workspace view, SHALL show who is signed in, SHALL provide sign-out, and SHALL not present controls for actions the signed-in role may not take.

#### Scenario: An unauthenticated visitor is sent to sign in

- **WHEN** a workspace view is opened without a session
- **THEN** the sign-in page is shown and no workspace data is rendered

#### Scenario: The signed-in account is visible

- **WHEN** a workspace view is open
- **THEN** the signed-in account and a sign-out control are shown

#### Scenario: A viewer sees no approval control

- **WHEN** a viewer opens the outreach review queue
- **THEN** the approve, reject and record-send controls are not presented

#### Scenario: A hidden control is also refused by the API

- **WHEN** a viewer issues an approval request directly
- **THEN** the API refuses it

### Requirement: Approvals are shown with who made them

The interface SHALL display the account that approved or rejected each outreach message, and the account that set a do-not-contact marker, alongside the time.

#### Scenario: An approved message shows its approver

- **WHEN** an approved message is displayed
- **THEN** the account that approved it and the time are shown

#### Scenario: A do-not-contact marker shows who set it

- **WHEN** a marked company or contact is displayed
- **THEN** the account that set the marker and the reason are shown
