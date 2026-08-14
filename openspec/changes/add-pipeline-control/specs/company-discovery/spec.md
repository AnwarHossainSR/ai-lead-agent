## MODIFIED Requirements

### Requirement: Only configured, permitted sources are consulted

The system SHALL consult only sources present in configuration and marked enabled, and SHALL construct each enabled source it consults — a source that exists in configuration but is never instantiated is not a source the system has. Before requesting anything from a source configured as crawlable, the system SHALL read that source's `robots.txt` and SHALL NOT request a path it disallows. The system SHALL honour the configured request rate for each source, and any crawl-delay the source declares, whichever is slower.

A source that is enabled but lacks the credentials or configuration it needs SHALL be reported as unusable with that reason, and SHALL NOT be presented as available. A run in which no source is usable SHALL fail with that reason rather than complete having stored nothing.

#### Scenario: A disabled source is not consulted

- **WHEN** a discovery run names a source that configuration marks disabled
- **THEN** the run fails with an error naming the source and the enabled sources
- **AND** no request is made

#### Scenario: An enabled source is actually consulted

- **WHEN** a discovery run is started and a source is enabled and configured
- **THEN** that source is constructed and asked for candidates, and its returned, stored, duplicate and rejected counts are recorded against the run

#### Scenario: An enabled source that is not configured is reported, not silently skipped

- **WHEN** a source is enabled but the credentials it needs are absent
- **THEN** the run records that source as unusable, naming what is missing, and does not present it as having returned nothing

#### Scenario: A run with no usable source fails

- **WHEN** every configured source is disabled, unconfigured or unreachable
- **THEN** the run ends as failed, naming each source and its reason
- **AND** it does not report success with zero companies stored

#### Scenario: A disallowed path is not requested

- **WHEN** a source's `robots.txt` disallows the path discovery would request
- **THEN** no request is made to that path
- **AND** the run records the source as skipped with that reason

#### Scenario: The declared crawl delay is honoured

- **WHEN** a source declares a crawl-delay longer than the configured request interval
- **THEN** requests to that source are spaced by the longer of the two

#### Scenario: A blocked source is abandoned, not evaded

- **WHEN** a source responds with a block, a challenge, or a bot check
- **THEN** the run records that source as blocked and stops requesting from it
- **AND** no attempt is made to disguise the request, solve the challenge, or retry through a different network path
