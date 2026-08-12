## Purpose

Defines how companies, contacts, website analyses, leads and outreach records are persisted, including the provenance and certainty of every researched claim, the uniqueness rules that prevent duplicate companies, and the controlled transitions a lead may make through its lifecycle.
## Requirements
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

### Requirement: Companies are deduplicated by normalized domain

The system SHALL derive a normalized domain from a company website by lowercasing the host, stripping the scheme, stripping a leading `www.`, stripping the port, and discarding path, query and fragment. The normalized domain SHALL be unique across companies. The system SHALL also store a normalized company name produced by lowercasing, collapsing whitespace, and removing common legal suffixes and punctuation.

#### Scenario: The same site in different forms resolves to one domain

- **WHEN** `https://WWW.Example.ae/about?x=1`, `http://example.ae`, and `https://example.ae:443/` are normalized
- **THEN** all three produce the normalized domain `example.ae`

#### Scenario: A duplicate company is rejected

- **WHEN** a company is persisted whose normalized domain already exists
- **THEN** the write fails with a uniqueness violation identifying the existing company
- **AND** exactly one company record for that domain remains

#### Scenario: Companies without a website are still storable

- **WHEN** a company is persisted with no website
- **THEN** the record is created with an unknown website and unknown normalized domain
- **AND** it does not collide with other website-less companies

#### Scenario: Legal suffixes do not create distinct normalized names

- **WHEN** `Example Trading L.L.C.` and `example trading llc` are normalized
- **THEN** both produce the same normalized name

### Requirement: Contacts are persisted with confidence and never fabricated

The system SHALL persist a contact record containing: a generated identifier, the owning company identifier, name, job title, LinkedIn URL, email, phone, a confidence marker, research source, source URL, and creation and update timestamps. Every stored email and phone SHALL be accompanied by its source and source URL. The system SHALL NOT store an email or phone value that was pattern-guessed rather than observed.

#### Scenario: A researched contact is stored with its evidence

- **WHEN** a contact is persisted with a name, job title, source and source URL
- **THEN** the record is stored and linked to its company

#### Scenario: Contact details without a source are refused

- **WHEN** a contact is persisted with an email or phone but no source URL for it
- **THEN** the write fails and no record is created

#### Scenario: Missing contact details are unknown, not empty

- **WHEN** a contact's email could not be found
- **THEN** the stored email is unknown
- **AND** consumers can distinguish "no email found" from "email is an empty string"

#### Scenario: Contacts are removed with their company

- **WHEN** a company is deleted
- **THEN** its contacts are deleted with it and no orphaned contact remains

### Requirement: Website analyses are persisted as evidence-backed snapshots

The system SHALL persist a website analysis record containing: a generated identifier, the owning company identifier, the analyzed URL, detected technology stack, performance score, accessibility score, SEO score, mobile score, UX score, observations, detected business opportunities, an analysis summary, and creation and update timestamps. Each numeric score SHALL be either a value in 0–100 or unknown. Each observation SHALL record what was observed and where the evidence came from. A company MAY have many analyses over time and the system SHALL be able to return the most recent one.

#### Scenario: An analysis is stored and retrievable as the latest

- **WHEN** two analyses are stored for the same company at different times
- **THEN** both are retained
- **AND** the latest analysis for that company is the more recently created one

#### Scenario: Unmeasured scores are unknown rather than zero

- **WHEN** an analysis is stored where the accessibility score could not be measured
- **THEN** the stored accessibility score is unknown
- **AND** it is not reported as 0

#### Scenario: An out-of-range score is refused

- **WHEN** an analysis is stored with a score below 0 or above 100
- **THEN** the write fails with a range error

#### Scenario: Observations carry evidence

- **WHEN** an observation is stored
- **THEN** it records the observed fact and the evidence that supports it
- **AND** an observation without evidence is refused

### Requirement: Leads are persisted with a component score breakdown and explanation

The system SHALL persist a lead record containing: a generated identifier, the owning company identifier, total lead score, priority, a per-component score breakdown matching the configured scoring components, a human-readable score explanation, recommended service identifier, reason for contacting, status, and creation and update timestamps. The total lead score SHALL be in 0–100. The priority SHALL match the band the total score falls into under the configured priority bands. A company SHALL have at most one lead record.

#### Scenario: A lead stores its full breakdown

- **WHEN** a lead is persisted with scores for every configured component
- **THEN** the record stores each component score, the total, the priority, and the explanation

#### Scenario: A lead without an explanation is refused

- **WHEN** a lead is persisted with a score but no score explanation
- **THEN** the write fails and no record is created

#### Scenario: A component score exceeding its configured maximum is refused

- **WHEN** a lead is persisted with a component score greater than that component's configured maximum
- **THEN** the write fails with an error naming the component, the submitted value and the maximum

#### Scenario: A second lead for the same company is refused

- **WHEN** a lead is persisted for a company that already has a lead
- **THEN** the write fails with a uniqueness violation

#### Scenario: A lead references a configured service

- **WHEN** a lead is persisted with a recommended service identifier not defined in the product configuration
- **THEN** the write fails with an error naming the unknown identifier

### Requirement: Lead status changes are controlled

The system SHALL reject any lead status change that the configured lifecycle does not permit. A newly created lead SHALL start at the configured initial status. Every accepted status change SHALL update the lead's update timestamp.

#### Scenario: A permitted status change succeeds

- **WHEN** a lead in `verified` is changed to `analyzing`
- **THEN** the change is applied and the update timestamp advances

#### Scenario: An impermissible status change is rejected

- **WHEN** a lead in `discovered` is changed to `won`
- **THEN** the change is rejected, the stored status remains `discovered`, and the error names the permitted targets

#### Scenario: A lead starts at the initial status

- **WHEN** a lead is created without an explicit status
- **THEN** its status is the configured initial status

### Requirement: Outreach records are persisted and require human approval before sending

The system SHALL persist an outreach record containing: a generated identifier, the owning lead identifier, channel, message body, status, approval timestamp, sent timestamp, response timestamp, notes, and creation and update timestamps. The channel SHALL be one of the configured outreach channels. An outreach record SHALL NOT be marked as sent unless it carries an approval timestamp. The data model SHALL provide no mechanism that transmits a message.

#### Scenario: A draft is stored unapproved and unsent

- **WHEN** an outreach draft is persisted
- **THEN** its status is a draft state with no approval timestamp and no sent timestamp

#### Scenario: Sending without approval is refused

- **WHEN** an outreach record is marked as sent while its approval timestamp is unset
- **THEN** the write fails and the record remains unsent

#### Scenario: An approved record can be marked sent

- **WHEN** an outreach record is approved and then marked as sent
- **THEN** both the approval and sent timestamps are stored and the sent timestamp is not earlier than the approval timestamp

#### Scenario: An unknown channel is refused

- **WHEN** an outreach record is persisted with a channel not present in the product configuration
- **THEN** the write fails with an error naming the unknown channel

### Requirement: Schema changes are delivered as reviewable migrations

The system SHALL express every schema change as a versioned migration file committed to the repository. Applying all migrations to an empty database SHALL produce the current schema. The system SHALL provide a command that reports whether the committed migrations and the declared schema have diverged.

#### Scenario: Migrations build the schema from empty

- **WHEN** all migrations are applied to an empty database
- **THEN** every table, index and constraint described by this capability exists

#### Scenario: Applying migrations twice is safe

- **WHEN** the migration command is run against an already-migrated database
- **THEN** it completes successfully and makes no further changes

#### Scenario: Drift between schema and migrations is detected

- **WHEN** the declared schema is edited without generating a migration
- **THEN** the drift check fails and names the undeclared change

### Requirement: Seed data is explicit, deterministic and local-only

The system SHALL provide a seed command that populates the database with a small, clearly-labelled example dataset for local development. Seeded records SHALL be identifiable as example data. Running the seed twice SHALL NOT create duplicate records. The seed command SHALL refuse to run against a database not designated as a development database.

#### Scenario: Seeding is idempotent

- **WHEN** the seed command is run twice against the same database
- **THEN** the record counts after the second run equal the counts after the first

#### Scenario: Seeded data is marked as example data

- **WHEN** seeded records are read
- **THEN** each is identifiable as example data and not mistakable for researched data

#### Scenario: Seeding a non-development database is refused

- **WHEN** the seed command is run against a database not designated as development
- **THEN** it exits with an error and writes nothing

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

### Requirement: Model calls are persisted as an audit trail

The system SHALL persist one record per language model call, carrying the prompt name, prompt version, model identifier, input and output token counts, estimated cost, latency, outcome, and the time it occurred. The record SHALL NOT contain the API key. Records SHALL be retained independently of the entities that reference them, so deleting a company does not erase the accounting for work already paid for.

#### Scenario: An invocation is stored with its accounting

- **WHEN** a model call completes
- **THEN** a row exists carrying the prompt name, version, model, input and output token counts, estimated cost, latency and outcome

#### Scenario: An invocation carries no credential

- **WHEN** an invocation row is inspected
- **THEN** it contains no API key and no rendered prompt text

#### Scenario: An unrecognised outcome is refused

- **WHEN** a write attempts to store an outcome outside the defined set
- **THEN** the database rejects it

### Requirement: AI-derived values reference the call that produced them

Any stored value the system derives from a language model SHALL carry a reference to its invocation record. A write that supplies an AI-derived value without such a reference SHALL be rejected, so an inferred fact can always be distinguished from an observed one and traced to its source.

#### Scenario: A derived value carries its invocation

- **WHEN** a value produced by a model call is stored
- **THEN** the stored row references the invocation that produced it

#### Scenario: A derived value without an invocation is refused

- **WHEN** a write supplies an AI-derived value with no invocation reference
- **THEN** the write is rejected naming the missing reference

#### Scenario: Deleting the subject preserves the accounting

- **WHEN** an entity holding AI-derived values is deleted
- **THEN** its invocation records remain

### Requirement: Discovery runs are persisted with their outcome

The system SHALL persist one record per discovery run carrying the requested country, city and industry, the time it started and finished, its outcome, and the limits it was bounded by. Outcomes SHALL distinguish a completed run, a partially completed run, a run that reached a limit, and a failed run.

#### Scenario: A run is stored with its request and outcome

- **WHEN** a discovery run finishes
- **THEN** a row exists carrying the requested territory, industry, start and finish times, and an outcome

#### Scenario: An unrecognised outcome is refused

- **WHEN** a write attempts to store a run outcome outside the defined set
- **THEN** the database rejects it

#### Scenario: A finished run cannot finish before it started

- **WHEN** a write attempts to store a finish time earlier than the start time
- **THEN** the database rejects it

### Requirement: Per-source results are persisted separately from the run

The system SHALL persist, for each source consulted by a run, the candidates returned, stored, deduplicated and rejected, and the source's own outcome including skipped and blocked. Rejection reasons SHALL be persisted in a form that can be counted by reason.

#### Scenario: Each consulted source has its own row

- **WHEN** a run consults three sources
- **THEN** three per-source rows exist referencing that run

#### Scenario: Counts cannot be negative

- **WHEN** a write attempts to store a negative candidate count
- **THEN** the database rejects it

#### Scenario: Deleting a run removes its per-source rows

- **WHEN** a discovery run is deleted
- **THEN** its per-source rows are deleted with it

### Requirement: A company records the run that first found it

The system SHALL record on each company the discovery run that created it, where one exists. Deleting a discovery run SHALL NOT delete the companies it found.

#### Scenario: A discovered company references its run

- **WHEN** a company is created by a discovery run
- **THEN** the company row references that run

#### Scenario: Companies survive their run's deletion

- **WHEN** a discovery run is deleted
- **THEN** the companies it found remain, with no run reference

#### Scenario: A manually created company needs no run

- **WHEN** a company is created outside any run
- **THEN** the company is stored with no run reference

### Requirement: A company records every source that found it

The system SHALL record each distinct source that has produced a given company, with the URL it was found at and when. Rediscovery by an already-recorded source SHALL update the time rather than add a duplicate row.

#### Scenario: A second source is recorded against an existing company

- **WHEN** a second source produces a company already stored
- **THEN** the company has two source records

#### Scenario: Rediscovery by the same source is not duplicated

- **WHEN** the same source produces the same company twice
- **THEN** one source record exists for that pair, with an updated time

