## ADDED Requirements

### Requirement: The verification rule is configuration

The system SHALL declare the verification rule as validated configuration naming each check, whether it is required, whether it is sufficient on its own, its timeout, and the staleness window after which a verdict must be re-derived. The rule SHALL be validated at load time: a rule naming an unknown check, declaring no required check, or declaring a non-positive timeout or window SHALL fail immediately.

#### Scenario: A rule naming an unknown check fails at load

- **WHEN** the configured rule names a check identifier that no check implements
- **THEN** loading the configuration fails with an error naming the unknown check

#### Scenario: A rule with no required check fails at load

- **WHEN** the configured rule marks no check as required
- **THEN** loading the configuration fails stating that at least one check must be required

#### Scenario: A non-positive staleness window fails at load

- **WHEN** the staleness window is configured as zero or negative
- **THEN** loading the configuration fails naming the setting

#### Scenario: Changing which checks are required needs no code change

- **WHEN** a check's required flag is changed in configuration
- **THEN** the derived verdict changes accordingly with no change to verification logic

### Requirement: Per-host politeness limits are configuration

The system SHALL declare the minimum interval between requests to a single host and the maximum requests per company as validated configuration. The configuration SHALL contain no setting that permits ignoring `robots.txt`, defeating a challenge, or exceeding a host's declared limits.

#### Scenario: A non-positive request interval fails at load

- **WHEN** the per-host interval is configured as zero or negative
- **THEN** loading the configuration fails naming the setting

#### Scenario: There is no politeness override

- **WHEN** the verification configuration schema is inspected
- **THEN** it contains no field that would permit ignoring `robots.txt` or a host's declared limits
