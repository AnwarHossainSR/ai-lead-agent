## ADDED Requirements

### Requirement: Consequential actions carry the account that performed them

The system SHALL record an actor reference on every outreach approval, rejection, manual send record and do-not-contact marker. A write recording one of those actions without an actor SHALL be rejected. Deleting an account SHALL NOT be permitted while actions reference it; an account is disabled instead.

#### Scenario: An approval stores its actor

- **WHEN** an outreach message is approved
- **THEN** the row carries the account that approved it

#### Scenario: An approval without an actor is refused

- **WHEN** a write attempts to record an approval with no actor reference
- **THEN** the database rejects it

#### Scenario: A do-not-contact marker stores its actor

- **WHEN** a company or contact is marked as not to be contacted
- **THEN** the row carries the account that set it

#### Scenario: An account referenced by actions cannot be deleted

- **WHEN** deletion is attempted for an account referenced by a recorded action
- **THEN** the deletion is refused

### Requirement: Accounts, sessions and audit entries are persisted

The system SHALL persist accounts with a unique identifier, an email address unique across accounts, a password hash, a role, a disabled marker and timestamps; sessions with their account, expiry and revocation state; and audit entries that are append-only. A password hash SHALL never be returned by a read helper.

#### Scenario: A duplicate email is refused

- **WHEN** a second account is created with an existing email address
- **THEN** the write is refused

#### Scenario: An unrecognised role is refused

- **WHEN** a write attempts to store a role outside the defined set
- **THEN** the database rejects it

#### Scenario: A password hash is not returned by reads

- **WHEN** an account is read through the public read helpers
- **THEN** the result carries no password hash

#### Scenario: Audit entries cannot be updated or deleted

- **WHEN** an update or delete is attempted against an audit entry
- **THEN** it is refused

#### Scenario: Expired and revoked sessions are distinguishable

- **WHEN** an expired session and a revoked session are read
- **THEN** the two states are distinguishable
