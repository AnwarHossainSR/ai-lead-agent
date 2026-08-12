## Purpose

Defines the platform's domain vocabulary — target markets, industries, offered services, lead lifecycle, priority bands, outreach channels and scoring weights — as validated configuration data, so the business definition of the product can change without changing application code.
## Requirements
### Requirement: Target markets are configuration

The system SHALL define its target countries and cities as configuration data. Each country entry SHALL carry a stable identifier, a display name, an ISO 3166-1 alpha-2 code, and an enabled flag. Each city entry SHALL carry a stable identifier, a display name, and the identifier of the country it belongs to. The system SHALL NOT hardcode country or city names in application logic.

#### Scenario: Initial markets are present

- **WHEN** the target market configuration is loaded
- **THEN** it contains United Arab Emirates and Saudi Arabia as enabled countries
- **AND** it contains Dubai and Abu Dhabi under United Arab Emirates, and Riyadh and Jeddah under Saudi Arabia

#### Scenario: A new city is added without code changes

- **WHEN** a new city entry referencing an existing country identifier is added to the configuration
- **THEN** the configuration loads successfully and the new city is available to every consumer
- **AND** no application source file outside the configuration needs to be edited

#### Scenario: A city references an unknown country

- **WHEN** the configuration contains a city whose country identifier does not match any configured country
- **THEN** configuration loading fails with an error naming the offending city and the unknown country identifier

#### Scenario: Disabled countries are excluded from active targeting

- **WHEN** a country is marked as not enabled
- **THEN** the list of active target countries excludes it and its cities
- **AND** the country remains resolvable by identifier so historical records referencing it still render

### Requirement: Industries are configuration

The system SHALL define target industries as configuration data. Each industry entry SHALL carry a stable identifier, a display name, and an enabled flag. Industry identifiers SHALL be unique.

#### Scenario: Initial industries are present

- **WHEN** the industry configuration is loaded
- **THEN** it contains Real Estate, Logistics, Hospitality, E-Commerce and Business Services as enabled industries

#### Scenario: Duplicate industry identifiers are rejected

- **WHEN** the configuration contains two industries with the same identifier
- **THEN** configuration loading fails with an error naming the duplicated identifier

### Requirement: Offered services are configuration

The system SHALL define the services that can be recommended to a lead as configuration data. Each service entry SHALL carry a stable identifier, a display name, and a short description of what the service delivers. Every recommended service produced anywhere in the platform SHALL reference one of these identifiers.

#### Scenario: Initial services are present

- **WHEN** the service configuration is loaded
- **THEN** it includes at minimum website modernization, web application development, custom business platforms, backend and API development, and AWS and cloud modernization

#### Scenario: An unknown service identifier is rejected

- **WHEN** a consumer resolves a service identifier that is not present in the configuration
- **THEN** the resolution fails with an error naming the unknown identifier rather than returning a default or empty service

### Requirement: Lead lifecycle statuses and transitions are configuration

The system SHALL define the set of lead statuses and, for each status, the set of statuses it may transition to. The configured statuses SHALL be: discovered, verified, analyzing, qualified, high_priority, contacted, replied, interested, meeting, proposal, won, lost, not_interested, rejected. The system SHALL expose a decision function that answers whether a given transition is permitted.

#### Scenario: A permitted transition is allowed

- **WHEN** a transition from `discovered` to `verified` is checked
- **THEN** the transition is reported as permitted

#### Scenario: An arbitrary transition is refused

- **WHEN** a transition from `discovered` to `won` is checked
- **THEN** the transition is reported as not permitted
- **AND** the refusal names the source status, the target status, and the statuses that are permitted from the source

#### Scenario: Terminal statuses have no outbound transitions

- **WHEN** the permitted transitions from `won`, `lost`, `not_interested` or `rejected` are requested
- **THEN** an empty set is returned

#### Scenario: Every configured transition target is a known status

- **WHEN** the lifecycle configuration is loaded
- **THEN** loading fails if any transition target is not itself a configured status

### Requirement: Lead priority bands are configuration

The system SHALL classify a lead score between 0 and 100 into a named priority band using configured score ranges. The default bands SHALL be: 90–100 very_high, 80–89 high, 70–79 medium, below 70 low.

#### Scenario: A score is classified into its band

- **WHEN** a lead score of 92 is classified
- **THEN** the priority is `very_high`

#### Scenario: Band boundaries are inclusive and unambiguous

- **WHEN** scores of 90, 89, 80, 79, 70 and 69 are classified
- **THEN** the results are `very_high`, `high`, `high`, `medium`, `medium` and `low` respectively

#### Scenario: Bands cover the full range without gaps or overlap

- **WHEN** the priority band configuration is loaded
- **THEN** loading fails if the bands leave any score in 0–100 unclassified or assign any score to more than one band

#### Scenario: An out-of-range score is refused

- **WHEN** a score below 0 or above 100 is classified
- **THEN** classification fails with an error stating the valid range

### Requirement: Lead scoring weights are configuration

The system SHALL define lead scoring as a set of weighted components, each with a stable identifier, a display name, and a maximum point value. The default components SHALL be business fit (30), technical opportunity (30), business opportunity (20), decision maker found (10), and company quality (10).

#### Scenario: Default weights total 100

- **WHEN** the scoring weight configuration is loaded
- **THEN** the sum of all component maximums equals 100

#### Scenario: Weights that do not total 100 are rejected

- **WHEN** the configuration is edited so component maximums sum to a value other than 100
- **THEN** configuration loading fails with an error reporting the actual total

#### Scenario: Weights can be retuned without code changes

- **WHEN** a component maximum is changed and another is changed so the total remains 100
- **THEN** the configuration loads successfully and consumers observe the new maximums

### Requirement: Outreach channels are configuration

The system SHALL define the available outreach channels as configuration data. The configured channels SHALL be email, linkedin and whatsapp. Each channel SHALL declare whether automated sending is permitted; in this change every channel SHALL declare automated sending as not permitted.

#### Scenario: No channel permits automated sending

- **WHEN** the outreach channel configuration is loaded
- **THEN** every channel reports that automated sending is not permitted

### Requirement: Configuration is validated at load time

The system SHALL validate all product configuration against an explicit schema when it is loaded, and SHALL fail loudly on the first invalid value rather than falling back to defaults or silently dropping entries. Validated configuration SHALL be exposed to consumers as read-only typed values.

#### Scenario: Invalid configuration halts startup

- **WHEN** any part of the product configuration fails schema validation
- **THEN** loading throws an error identifying the failing field path and the reason
- **AND** no partially-validated configuration object is returned

#### Scenario: Consumers cannot mutate configuration

- **WHEN** a consumer attempts to modify a loaded configuration value at runtime
- **THEN** the modification is rejected and the configuration remains unchanged

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

