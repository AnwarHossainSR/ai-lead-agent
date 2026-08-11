## ADDED Requirements

### Requirement: Contact research runs are persisted with their outcome

The system SHALL persist one record per contact research run carrying the company, the pages fetched, the pages skipped with reasons, the outcome, the number of contacts found and rejected, and the rejection reasons. Outcomes SHALL distinguish contacts found, none found, blocked, skipped and failed.

#### Scenario: A run records what it fetched and found

- **WHEN** a contact research run finishes
- **THEN** a row exists carrying the pages fetched, the pages skipped with reasons, the outcome and the found and rejected counts

#### Scenario: None found differs from blocked

- **WHEN** a run that found nothing and a run that was blocked are compared
- **THEN** the two are distinguishable

#### Scenario: An unrecognised outcome is refused

- **WHEN** a write attempts to store an outcome outside the defined set
- **THEN** the database rejects it

#### Scenario: Deleting a company removes its runs

- **WHEN** a company is deleted
- **THEN** its contact research runs are deleted with it

### Requirement: Seniority is stored as a configured level or unknown

The system SHALL store a contact's seniority as one of the configured levels or as unknown. It SHALL reject a seniority value outside the configured set, and SHALL reject a seniority on a contact with no job title.

#### Scenario: A configured level is stored

- **WHEN** a contact with a matched role is stored
- **THEN** its seniority is the configured level

#### Scenario: An unconfigured level is refused

- **WHEN** a write attempts to store a seniority outside the configured set
- **THEN** the database rejects it

#### Scenario: Seniority without a title is refused

- **WHEN** a write attempts to store a seniority on a contact with no job title
- **THEN** the database rejects it

## MODIFIED Requirements

### Requirement: Contacts are persisted with confidence and never fabricated

The system SHALL persist a contact record containing: a generated identifier, the owning company identifier, name, job title, LinkedIn URL, email, phone, a confidence marker, research source, source URL, the extraction method that produced it, the seniority level, the mail deliverability state of the email's domain, a reference to the model invocation where interpretation was involved, and creation and update timestamps. Every stored email and phone SHALL be accompanied by its source and source URL. The system SHALL NOT store an email or phone value that was pattern-guessed, permuted or otherwise constructed rather than observed in fetched content. Every stored contact SHALL name the extraction method that produced it, and a contact whose method is model interpretation SHALL carry an invocation reference.

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

#### Scenario: A contact without an extraction method is refused

- **WHEN** a contact is persisted with no extraction method
- **THEN** the write fails naming the missing field

#### Scenario: An interpreted contact without an invocation is refused

- **WHEN** a contact whose extraction method is model interpretation is persisted with no invocation reference
- **THEN** the write fails naming the missing reference

#### Scenario: Deliverability is stored as a tri-state

- **WHEN** a contact with an email is stored
- **THEN** its domain deliverability is recorded as receivable, not receivable, or unknown
