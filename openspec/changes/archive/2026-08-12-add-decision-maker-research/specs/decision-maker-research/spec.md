## Purpose

Finds the people at a company who could be contacted, taking only what the company itself published on pages the platform actually fetched, recording the URL for every claim, never constructing a contact detail that was not published, and keeping a published fact distinguishable from an interpreted one.

## ADDED Requirements

### Requirement: A contact detail is never constructed

The system SHALL store an email address or telephone number only when that exact value appeared in fetched content. The system SHALL NOT generate, permute, pattern-match or otherwise derive a contact detail from a person's name, a company domain, or any other value. No configuration, parameter or code path SHALL enable it.

#### Scenario: A published address is stored

- **WHEN** an email address appears in a fetched page
- **THEN** it is stored with the URL of the page it appeared on

#### Scenario: An address is not derived from a name and a domain

- **WHEN** a person's name and the company's domain are known and no address was published
- **THEN** no email address is stored for that person

#### Scenario: There is no address generator

- **WHEN** the module's code and configuration are inspected
- **THEN** they contain no email pattern list, permutation generator, or address-construction function

#### Scenario: A near-match is not treated as a find

- **WHEN** a page contains an address at a different domain from the company's
- **THEN** it is stored with the domain it actually has, and is not rewritten to the company's domain

### Requirement: Every claim carries the page it came from

The system SHALL record for every contact and every attribute of a contact the URL of the page the claim was taken from and the time it was fetched. A claim without a source URL SHALL NOT be stored.

#### Scenario: A contact carries its source

- **WHEN** a contact is stored
- **THEN** the record carries the URL it was found at and when

#### Scenario: A role carries its own source

- **WHEN** a contact's role is recorded
- **THEN** the record carries the URL the role was stated on

#### Scenario: A sourceless claim is refused

- **WHEN** an extraction yields a contact detail with no source URL
- **THEN** it is discarded and the rejection is recorded

### Requirement: Published facts and interpretations are distinguishable

The system SHALL record how each contact was obtained, distinguishing deterministic extraction from a fetched page from interpretation of page text by a model. Interpreted values SHALL carry a certainty of inferred and a reference to the model invocation; extracted values SHALL carry a certainty of observed.

#### Scenario: An extracted address is observed

- **WHEN** an address is taken from a `mailto:` link
- **THEN** the contact records an extraction method of deterministic extraction and a certainty of observed

#### Scenario: An interpreted role is inferred

- **WHEN** a person's role is identified by the model from page text
- **THEN** the role is recorded as inferred with a reference to the invocation

#### Scenario: An interpretation is traceable

- **WHEN** an inferred contact attribute is inspected
- **THEN** the invocation that produced it and the page text it rests on are both retrievable

### Requirement: The model is never asked for a contact detail

The system SHALL supply the model with page text and SHALL request only people's names, their stated roles and the text naming them. The model's output schema SHALL contain no field for an email address or telephone number, and any such value appearing in its output SHALL be discarded.

#### Scenario: The output schema has no contact detail field

- **WHEN** the people-extraction output schema is inspected
- **THEN** it contains no email or telephone field

#### Scenario: A model-supplied address is discarded

- **WHEN** the model returns text resembling an email address in a name or role field
- **THEN** that value is not stored as a contact detail

#### Scenario: A person without supporting text is rejected

- **WHEN** the model returns a person whose naming text does not appear in the supplied page
- **THEN** that person is discarded and the rejection is recorded

### Requirement: Only conventional business pages are fetched, politely

The system SHALL fetch only the pages already captured by website analysis and a configured list of conventional business paths. It SHALL evaluate `robots.txt` before each request, respect the per-host rate limit, and abandon a host that blocks it without attempting to evade the block.

#### Scenario: A disallowed page is not fetched

- **WHEN** `robots.txt` disallows a conventional path
- **THEN** it is not requested and the omission is recorded

#### Scenario: A blocking host ends research

- **WHEN** a host blocks the request
- **THEN** research ends for that company recorded as blocked
- **AND** no attempt is made to disguise the request

#### Scenario: Only configured paths are attempted

- **WHEN** research runs
- **THEN** the only URLs requested are the analysed pages and the configured conventional paths

### Requirement: Mail deliverability is checked without contacting a mailbox

The system SHALL determine whether an address's domain is able to receive mail by looking up that domain's mail exchange records only. It SHALL NOT open an SMTP session, issue a recipient probe, or send a message to test an address.

#### Scenario: A domain with mail records is marked receivable

- **WHEN** an address's domain publishes mail exchange records
- **THEN** the contact records that its domain can receive mail

#### Scenario: A domain without mail records is marked accordingly

- **WHEN** an address's domain publishes no mail exchange records
- **THEN** the contact records that its domain cannot receive mail
- **AND** the address itself is retained with its source

#### Scenario: No mailbox is probed

- **WHEN** deliverability is checked
- **THEN** no SMTP connection is opened and no message is sent

#### Scenario: A lookup failure yields unknown

- **WHEN** the mail record lookup fails or times out
- **THEN** deliverability is recorded as unknown rather than as unable to receive

### Requirement: Contacts are ranked by configured seniority, not invented importance

The system SHALL classify a contact's seniority by matching its stated role against configured role patterns, and SHALL record the level as unknown when no pattern matches. The system SHALL NOT assign a seniority to a contact whose role is unknown.

#### Scenario: A matching role yields its configured level

- **WHEN** a contact's stated role matches a configured pattern
- **THEN** the contact records that seniority level

#### Scenario: An unmatched role yields unknown seniority

- **WHEN** a contact's stated role matches no configured pattern
- **THEN** the seniority is recorded as unknown

#### Scenario: No role means no seniority

- **WHEN** a contact has no stated role
- **THEN** no seniority is recorded

### Requirement: Only business contact information is retained

The system SHALL store contact information only where it is presented as a business contact for the company. It SHALL NOT store information about people not presented in a business capacity, and SHALL support deleting all contacts for a company on request.

#### Scenario: A business contact page is used

- **WHEN** a page presents a person as a company contact
- **THEN** their published details may be stored

#### Scenario: Contacts can be erased for a company

- **WHEN** deletion of a company's contacts is requested
- **THEN** every contact record for that company is removed
