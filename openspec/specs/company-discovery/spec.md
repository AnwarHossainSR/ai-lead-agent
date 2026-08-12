# company-discovery Specification

## Purpose
Finds candidate companies in a configured territory from configured lawful sources, refuses any candidate it cannot trace back to where it was found, deduplicates against companies already known, and reports each run's real outcome — including what it rejected and why.
## Requirements
### Requirement: Every candidate carries where it was found

The system SHALL require every discovered candidate to carry the identifier of the source that produced it and a URL at which the claim can be inspected. A candidate lacking either SHALL be rejected and counted as rejected. The system SHALL NOT substitute a constructed or guessed URL for a missing one.

#### Scenario: A candidate with a source is accepted

- **WHEN** a source returns a candidate carrying its source identifier and a source URL
- **THEN** the candidate is accepted for deduplication

#### Scenario: A candidate without a source URL is rejected

- **WHEN** a source returns a candidate with no source URL
- **THEN** the candidate is rejected with a reason naming the missing field
- **AND** the run's rejected count includes it

#### Scenario: No URL is invented for a candidate

- **WHEN** a source supplies a company name but no website
- **THEN** the stored company has no website rather than a guessed one

### Requirement: Only configured, permitted sources are consulted

The system SHALL consult only sources present in configuration and marked enabled. Before requesting anything from a source configured as crawlable, the system SHALL read that source's `robots.txt` and SHALL NOT request a path it disallows. The system SHALL honour the configured request rate for each source, and any crawl-delay the source declares, whichever is slower.

#### Scenario: A disabled source is not consulted

- **WHEN** a discovery run names a source that configuration marks disabled
- **THEN** the run fails with an error naming the source and the enabled sources
- **AND** no request is made

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

### Requirement: Discovery is scoped to configured territory and industry

The system SHALL accept a discovery request identifying a country, an optional city, and an industry, each of which SHALL be a configured identifier. An unknown identifier SHALL be refused with an error naming what was supplied and what is configured.

#### Scenario: A configured territory is accepted

- **WHEN** a run is requested for a configured country, city and industry
- **THEN** the run proceeds against the sources enabled for that country

#### Scenario: An unknown industry is refused

- **WHEN** a run is requested for an industry identifier that is not configured
- **THEN** the request is refused with an error naming the supplied value and listing the configured industries
- **AND** no run is recorded as started

#### Scenario: A city outside its country is refused

- **WHEN** a run is requested for a city that is not configured as belonging to the supplied country
- **THEN** the request is refused naming both

### Requirement: Candidates are deduplicated deterministically

The system SHALL deduplicate candidates by normalized domain where a website is present, and SHALL compare normalized company name within the same country where it is not. A candidate matching an existing company SHALL update that company's provenance rather than create a second record. Deduplication SHALL NOT use a language model.

#### Scenario: The same company from two sources becomes one record

- **WHEN** two sources return the same company with website URLs differing only in scheme, `www.` prefix or trailing path
- **THEN** one company record exists
- **AND** it records both sources as having found it

#### Scenario: A rediscovered company is not duplicated

- **WHEN** a run rediscovers a company already stored
- **THEN** no new company row is created
- **AND** the run's duplicate count includes it

#### Scenario: Two website-less companies with different names coexist

- **WHEN** two candidates in the same country have no website and different normalized names
- **THEN** both are stored

#### Scenario: Two website-less companies with the same name are treated as one

- **WHEN** two candidates in the same country have no website and the same normalized name
- **THEN** one company record exists

### Requirement: Every run reports what actually happened

The system SHALL record for each run the requested territory and industry, the sources consulted, and per source the number of candidates returned, newly stored, deduplicated and rejected with reasons. A run that stored nothing SHALL be distinguishable from a run that failed and from a run that was blocked.

#### Scenario: A successful run reports its counts

- **WHEN** a run completes
- **THEN** its record carries per-source counts of returned, stored, duplicate and rejected candidates

#### Scenario: An empty result is not reported as a failure

- **WHEN** every consulted source returns zero candidates
- **THEN** the run completes with a zero stored count and a succeeded outcome

#### Scenario: A partial failure is visible

- **WHEN** one source fails and another succeeds
- **THEN** the run records the successful source's counts and the failed source's failure
- **AND** the run outcome states that it completed partially

#### Scenario: Rejections carry reasons

- **WHEN** candidates are rejected
- **THEN** each rejection reason is recorded and countable

### Requirement: A discovery run is bounded and interruptible

The system SHALL bound each run by a configurable maximum number of candidates and a maximum duration. Reaching either SHALL end the run with an outcome stating which limit was reached, and SHALL retain everything already stored.

#### Scenario: The candidate limit ends the run

- **WHEN** a run reaches its configured maximum candidate count
- **THEN** the run ends with an outcome naming that limit
- **AND** companies stored before the limit remain

#### Scenario: The time limit ends the run

- **WHEN** a run reaches its configured maximum duration
- **THEN** the run ends with an outcome naming that limit
- **AND** companies stored before the limit remain

### Requirement: Discovered data is stored as claimed, not as verified

The system SHALL store discovered attributes with a certainty of observed only for values the source stated, and SHALL store nothing for values the source omitted. The system SHALL NOT mark a discovered company as verified.

#### Scenario: Omitted attributes stay unknown

- **WHEN** a source supplies a name and website but no company size
- **THEN** the stored company records no company size rather than an estimate

#### Scenario: Discovery does not confer verification

- **WHEN** a company is created by a discovery run
- **THEN** it is stored as unverified

