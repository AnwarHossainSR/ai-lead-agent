## ADDED Requirements

### Requirement: Discovery sources are configuration, not code

The system SHALL declare each discovery source as validated configuration carrying a unique identifier, a display name, its kind, whether it is enabled, the countries it covers, its maximum request rate, and whether it may be crawled. Adding or disabling a source SHALL be a configuration edit requiring no change to discovery logic. Configuration SHALL be validated at load time, and an invalid declaration SHALL fail immediately rather than at the first run.

#### Scenario: A duplicate source identifier fails at load

- **WHEN** two configured sources declare the same identifier
- **THEN** loading the configuration fails with an error naming the duplicate

#### Scenario: A source covering an unconfigured country fails at load

- **WHEN** a source declares coverage of a country identifier that is not configured
- **THEN** loading the configuration fails naming the source and the unknown country

#### Scenario: A non-positive request rate fails at load

- **WHEN** a source declares a maximum request rate of zero or less
- **THEN** loading the configuration fails naming the source

#### Scenario: Resolving an unknown source is refused

- **WHEN** a source identifier that is not configured is resolved
- **THEN** the call fails with an error naming the requested identifier and listing the configured ones
- **AND** no default source is returned

### Requirement: Crawl permission is explicit per source

The system SHALL treat a source as not crawlable unless its configuration states otherwise. The configuration SHALL carry no setting that permits ignoring `robots.txt`, bypassing a bot check, or exceeding a source's declared crawl-delay.

#### Scenario: Crawl permission defaults to denied

- **WHEN** a source is configured without a crawl permission setting
- **THEN** it is treated as not crawlable

#### Scenario: There is no override for robots exclusion

- **WHEN** the discovery source configuration schema is inspected
- **THEN** it contains no field that would permit ignoring `robots.txt` or a declared crawl-delay
