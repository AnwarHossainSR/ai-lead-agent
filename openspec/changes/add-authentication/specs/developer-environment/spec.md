## ADDED Requirements

### Requirement: Authentication configuration is declared, validated and secret

The system SHALL declare every authentication environment variable in the committed example file with a placeholder and a comment, SHALL validate them at startup with a message naming the variable and its purpose on failure, and SHALL refuse to start outside development with a session secret that is missing, short, or equal to the committed placeholder.

#### Scenario: A missing session secret aborts startup

- **WHEN** the API starts with the session secret unset
- **THEN** startup aborts naming the variable and what it is for
- **AND** the process exits non-zero

#### Scenario: The placeholder secret is refused outside development

- **WHEN** the API starts outside development with the session secret equal to the committed placeholder
- **THEN** startup aborts stating that the placeholder may not be used

#### Scenario: The secret never reaches the logs

- **WHEN** startup and error output are inspected with the session secret set to a recognisable value
- **THEN** that value appears in neither

### Requirement: The first account is created by a documented command

The system SHALL provide a documented command that creates an operator account, SHALL refuse to create one with a weak password, and SHALL NOT print the password back.

#### Scenario: The documented command creates an operator

- **WHEN** the account creation command is run with an email and a password
- **THEN** an operator account exists

#### Scenario: A weak password is refused

- **WHEN** the command is run with a password below the configured minimum strength
- **THEN** it refuses stating the requirement and creates nothing

#### Scenario: The command does not echo the password

- **WHEN** the command completes
- **THEN** its output contains no password

### Requirement: The documentation reflects that the applications are protected

The system SHALL update its documentation to describe sign-in, account creation and the two roles, and SHALL remove the statement that the applications are unauthenticated and local-only.

#### Scenario: Setup documentation covers authentication

- **WHEN** the setup documentation is read
- **THEN** it describes creating the first account, signing in, and what each role may do

#### Scenario: The local-only statement is gone

- **WHEN** the documentation is inspected
- **THEN** it no longer states that the applications carry no authentication
