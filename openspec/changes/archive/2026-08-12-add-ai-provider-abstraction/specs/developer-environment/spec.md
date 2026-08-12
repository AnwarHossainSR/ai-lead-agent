## ADDED Requirements

### Requirement: AI provider configuration is declared and validated

The system SHALL declare every AI provider environment variable in the committed example file with a placeholder and an explanatory comment, and SHALL validate them at startup against a schema that names the variable and its purpose on failure. The provider API key SHALL be treated as a secret: it SHALL NOT appear in any committed file, log line, error message or health response.

#### Scenario: A missing API key aborts startup

- **WHEN** the API starts with the provider API key unset
- **THEN** startup aborts with an error naming the variable and what it is for
- **AND** the process exits non-zero

#### Scenario: A malformed spend ceiling is rejected

- **WHEN** the spend ceiling variable is set to a value that is not a positive number
- **THEN** startup aborts with an error naming the variable and the expected shape

#### Scenario: The example file lists the AI variables

- **WHEN** the set of AI variables the applications read is compared against the committed example file
- **THEN** every one is present with a placeholder and a comment

#### Scenario: The key never reaches the logs

- **WHEN** startup output and error output are inspected with the API key set to a recognisable value
- **THEN** that value appears in neither
