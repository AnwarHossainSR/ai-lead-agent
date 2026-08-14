## Purpose

Provides operator accounts, sessions and roles for the platform — closed by default at every route, revocable, rate-limited, and attributing every consequential action to the person who took it.

## ADDED Requirements

### Requirement: Routes are closed by default

The system SHALL reject an unauthenticated request to any route that has not been explicitly declared public. A route added without an access decision SHALL be protected. The health endpoint SHALL be public.

#### Scenario: An unauthenticated request is rejected

- **WHEN** a request without a valid session reaches a protected route
- **THEN** it is rejected with an unauthenticated status
- **AND** no data is returned

#### Scenario: A newly added route is protected without action

- **WHEN** a route is added with no access declaration
- **THEN** unauthenticated requests to it are rejected

#### Scenario: The health endpoint stays public

- **WHEN** the health endpoint is called without a session
- **THEN** it responds normally

#### Scenario: An expired session is rejected

- **WHEN** a request presents a session that has expired
- **THEN** it is rejected with an unauthenticated status

### Requirement: Sessions are server-side and revocable

The system SHALL store a session record on the server for every authenticated session, SHALL invalidate it on sign-out, and SHALL support revoking any session so that subsequent requests presenting it are rejected. Session cookies SHALL be HTTP-only, marked secure outside development, and restricted by same-site policy.

#### Scenario: Sign-out invalidates the session

- **WHEN** a user signs out and then repeats a request with the same cookie
- **THEN** the request is rejected

#### Scenario: A revoked session stops working immediately

- **WHEN** a session is revoked
- **THEN** the next request presenting it is rejected

#### Scenario: The cookie is not readable by scripts

- **WHEN** a session cookie is issued
- **THEN** it is marked HTTP-only and restricted by same-site policy

#### Scenario: The cookie is secure outside development

- **WHEN** a session cookie is issued outside development
- **THEN** it is marked secure

### Requirement: Credentials are stored and compared safely

The system SHALL store passwords only as salted hashes produced by a memory-hard algorithm, SHALL never log or return a password or a hash, and SHALL compare credentials in a way that does not reveal whether an account exists.

#### Scenario: A password is never stored in readable form

- **WHEN** an account is created
- **THEN** the stored record contains a salted hash and no readable password

#### Scenario: A wrong password and an unknown account fail identically

- **WHEN** a sign-in is attempted with an unknown address and with a known address and wrong password
- **THEN** both fail with the same message and neither reveals which case occurred

#### Scenario: Credentials never reach the logs

- **WHEN** a failed sign-in is logged
- **THEN** the log entry contains no password and no hash

### Requirement: Authentication attempts are rate limited

The system SHALL limit sign-in attempts per account and per source over a configured window, and SHALL reject further attempts beyond the limit with a message that states the limit without revealing account existence.

#### Scenario: Repeated failures are throttled

- **WHEN** sign-in attempts exceed the configured limit within the window
- **THEN** further attempts are rejected until the window passes

#### Scenario: Throttling does not reveal account existence

- **WHEN** the limit is reached for an unknown address
- **THEN** the response is indistinguishable from the limit being reached for a known one

#### Scenario: A successful sign-in is not blocked by another account's failures

- **WHEN** one account has been throttled
- **THEN** a different account can still sign in

### Requirement: Roles gate consequential actions

The system SHALL support an operator role permitted to take every action, and a viewer role permitted to read but not to approve outreach, mark a company or contact as not to be contacted, record a send, or trigger work that incurs a model cost. A refusal SHALL name the action and the role required.

#### Scenario: A viewer can read

- **WHEN** a viewer requests lead and company data
- **THEN** the data is returned

#### Scenario: A viewer cannot approve outreach

- **WHEN** a viewer attempts to approve an outreach message
- **THEN** the request is refused naming the action and the required role
- **AND** the message remains unapproved

#### Scenario: A viewer cannot spend

- **WHEN** a viewer attempts to trigger work that would call a model
- **THEN** the request is refused
- **AND** no model call is made

#### Scenario: An operator can take consequential actions

- **WHEN** an operator approves an outreach message
- **THEN** the approval succeeds

### Requirement: Accounts are created deliberately, not by sign-up

The system SHALL provide no public sign-up. Accounts SHALL be created by an existing operator or by a documented command, and SHALL be creatable with either role. An account SHALL be disableable, and a disabled account's sessions SHALL be revoked.

#### Scenario: There is no public sign-up

- **WHEN** the public routes are inspected
- **THEN** none creates an account

#### Scenario: An operator can create an account

- **WHEN** an operator creates an account with a role
- **THEN** the account exists with that role

#### Scenario: Disabling an account ends its sessions

- **WHEN** an account is disabled
- **THEN** its existing sessions are revoked and it cannot sign in

### Requirement: Consequential actions are attributed

The system SHALL record the account that approved or rejected an outreach message, marked a company or contact as not to be contacted, or recorded a manual send. The attribution SHALL be stored with the action and SHALL be readable wherever the action is displayed.

#### Scenario: An approval records who approved it

- **WHEN** an outreach message is approved
- **THEN** the record carries the account that approved it and the time

#### Scenario: A do-not-contact marker records who set it

- **WHEN** a company or contact is marked as not to be contacted
- **THEN** the record carries the account that set it

#### Scenario: Attribution survives the account being disabled

- **WHEN** an account that approved a message is disabled
- **THEN** the approval still identifies that account

### Requirement: Authentication and consequential actions are audited

The system SHALL append a record for each sign-in, failed sign-in, sign-out, session revocation, account creation, role change, account disablement, and each consequential action. The audit record SHALL NOT be editable through the application, and SHALL be retained independently of the records it refers to.

#### Scenario: A sign-in is audited

- **WHEN** a user signs in
- **THEN** an audit record exists carrying the account, the time and the outcome

#### Scenario: A failed sign-in is audited without the credential

- **WHEN** a sign-in fails
- **THEN** an audit record exists with the outcome and no password

#### Scenario: Audit records cannot be edited

- **WHEN** an attempt is made to modify or delete an audit record through the application
- **THEN** it is refused

#### Scenario: Audit records outlive their subjects

- **WHEN** a record referred to by an audit entry is deleted
- **THEN** the audit entry remains
