## ADDED Requirements

### Requirement: Seniority levels and role patterns are configuration

The system SHALL declare seniority levels as ordered validated configuration, each with a unique identifier, a display name and a rank, together with the role patterns that map a stated job title to a level. Duplicate identifiers, duplicate ranks, a pattern mapping to an unknown level, or an invalid pattern SHALL fail at load.

#### Scenario: A duplicate seniority identifier fails at load

- **WHEN** two seniority levels declare the same identifier
- **THEN** loading the configuration fails naming the duplicate

#### Scenario: Duplicate ranks fail at load

- **WHEN** two seniority levels declare the same rank
- **THEN** loading the configuration fails naming both

#### Scenario: A pattern mapping to an unknown level fails at load

- **WHEN** a role pattern maps to a seniority identifier that is not configured
- **THEN** loading the configuration fails naming the pattern and the unknown level

#### Scenario: Adding a role pattern needs no code change

- **WHEN** a new role pattern is added to configuration
- **THEN** titles matching it classify to the mapped level with no change to classification logic

### Requirement: The pages research may fetch are configuration

The system SHALL declare as validated configuration the conventional paths contact research may request. The configuration SHALL contain no email pattern, address template, permutation rule, or any setting that would enable constructing a contact detail.

#### Scenario: Only configured paths may be requested

- **WHEN** the configured path list is changed
- **THEN** research requests the new set and no others

#### Scenario: There is no address construction setting

- **WHEN** the contact research configuration schema is inspected
- **THEN** it contains no email pattern, address template or permutation field
