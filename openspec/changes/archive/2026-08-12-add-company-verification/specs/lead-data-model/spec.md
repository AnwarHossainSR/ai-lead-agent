## ADDED Requirements

### Requirement: Check results are persisted individually with their evidence

The system SHALL persist one record per check run per company, carrying the check identifier, the verdict, the evidence, the URL or identifier at which the evidence can be inspected, and the time it ran. A record with a passed or failed verdict and no evidence SHALL be rejected. Records SHALL accumulate rather than being overwritten, so an earlier verdict remains inspectable after re-verification.

#### Scenario: A check result is stored with its evidence

- **WHEN** a check completes with a passed or failed verdict
- **THEN** a row exists carrying the check identifier, the verdict, the evidence and its source

#### Scenario: A verdict without evidence is refused

- **WHEN** a write attempts to store a passed or failed verdict with no evidence
- **THEN** the database rejects it

#### Scenario: An unknown verdict needs no evidence

- **WHEN** a check result with an unknown verdict and no evidence is stored
- **THEN** the write succeeds

#### Scenario: Re-verification does not erase earlier results

- **WHEN** a company is verified twice
- **THEN** both runs' check records exist

#### Scenario: Deleting a company removes its check records

- **WHEN** a company is deleted
- **THEN** its check records are deleted with it

### Requirement: A company carries a derived verification state

The system SHALL record on each company a verification state, the time it was derived, and the identifier of the run that derived it. The state SHALL distinguish never checked, verified, unverified and unreachable. A write SHALL NOT set the state without also setting the time it was derived.

#### Scenario: An unchecked company has no verification time

- **WHEN** a company has never been verified
- **THEN** its state is never checked and it carries no derivation time

#### Scenario: A state requires its derivation time

- **WHEN** a write attempts to set a verification state without a derivation time
- **THEN** the database rejects it

#### Scenario: An unrecognised state is refused

- **WHEN** a write attempts to store a verification state outside the defined set
- **THEN** the database rejects it

#### Scenario: Stale verdicts are queryable

- **WHEN** companies are queried for a derivation time older than a given moment
- **THEN** the query is served by an index rather than a full scan

## MODIFIED Requirements

### Requirement: Companies are persisted with provenance

The system SHALL persist a company record containing: a generated identifier, name, normalized name, country identifier, city identifier, industry identifier, website URL, normalized website domain, LinkedIn URL, company size, description, discovery source, discovery source URL, verification status, and creation and update timestamps. Country, city and industry values SHALL reference identifiers defined by the product configuration. Discovery source and discovery source URL SHALL be recorded for every company; a company SHALL NOT be persisted without a source. Verification status SHALL NOT be settable by a caller creating or updating a company: it is derived by the verification capability and written only through that path, together with the time it was derived.

#### Scenario: A discovered company is stored with its source

- **WHEN** a company is persisted with a name, website, country, city, industry, source and source URL
- **THEN** the record is stored and readable with all supplied values intact
- **AND** creation and update timestamps are set automatically

#### Scenario: A company without a source is refused

- **WHEN** a company is persisted without a discovery source
- **THEN** the write fails and no record is created

#### Scenario: A company referencing unknown configuration is refused

- **WHEN** a company is persisted with a country, city or industry identifier that the product configuration does not define
- **THEN** the write fails with an error naming the unknown identifier

#### Scenario: Unknown optional attributes are recorded as unknown

- **WHEN** a company's LinkedIn URL, company size or description could not be established
- **THEN** the stored record represents those fields as unknown
- **AND** reading the record does not present a guessed or empty-string value as a researched fact

#### Scenario: A caller cannot claim verification at creation

- **WHEN** a company is persisted with an attempt to set its verification status
- **THEN** the company is stored unverified

#### Scenario: A caller cannot claim verification at update

- **WHEN** a company update attempts to set the verification status directly
- **THEN** the write is refused with an error stating that verification is derived
