# company-verification Specification

## Purpose
Establishes whether a discovered company actually exists and is reachable, using checks that each produce inspectable evidence or explicitly return unknown, combined by a deterministic configured rule into a verdict that can be re-derived from its evidence and re-checked once it goes stale.
## Requirements
### Requirement: A check produces evidence or returns unknown

Every verification check SHALL return a verdict of passed, failed or unknown. A passed or failed verdict SHALL carry evidence describing what was observed and a URL or identifier at which it can be inspected. A check that cannot reach its source, times out, or receives an unusable response SHALL return unknown. A check SHALL NOT return a verdict it cannot evidence.

#### Scenario: A passing check carries its evidence

- **WHEN** a check confirms a company attribute
- **THEN** it returns passed with evidence describing the observation and where it was made

#### Scenario: A failing check carries its evidence

- **WHEN** a check establishes that a company attribute is not as claimed
- **THEN** it returns failed with evidence describing what was found instead

#### Scenario: An unreachable source yields unknown, not failed

- **WHEN** a check's source cannot be reached or does not respond within its timeout
- **THEN** the check returns unknown
- **AND** the company is not recorded as failing that check

#### Scenario: A check without evidence cannot report a verdict

- **WHEN** a check would return passed or failed without evidence
- **THEN** the result is rejected and recorded as unknown with the reason

### Requirement: The verdict is derived deterministically from the checks

The system SHALL combine check results into a company verdict using a configured rule naming which checks are required, which are sufficient, and how unknown results are treated. The rule SHALL NOT use a language model. The same set of check results SHALL always produce the same verdict, and the verdict SHALL be re-derivable from the stored check records.

#### Scenario: Required checks passing yields verified

- **WHEN** every check the rule marks required returns passed
- **THEN** the company verdict is verified

#### Scenario: A required check failing yields unverified

- **WHEN** a check the rule marks required returns failed
- **THEN** the company verdict is unverified
- **AND** the verdict names the check that failed

#### Scenario: Unknown results do not become a pass

- **WHEN** a required check returns unknown and no other check fails
- **THEN** the company verdict is neither verified nor unverified but unreachable
- **AND** the company is not treated as verified anywhere downstream

#### Scenario: The verdict can be recomputed from evidence

- **WHEN** a company's stored check records are re-evaluated against the same rule
- **THEN** the resulting verdict equals the stored one

### Requirement: Verified status is set only by verification

The system SHALL NOT accept a verified flag from any caller creating or updating a company. Verified status SHALL be a derived value written only by the verification path, together with the time it was derived.

#### Scenario: A create call cannot claim verification

- **WHEN** a company is created with an attempt to set it verified
- **THEN** the attempt is refused or ignored and the company is stored unverified

#### Scenario: An update call cannot claim verification

- **WHEN** a company update attempts to set the verified flag directly
- **THEN** the attempt is refused

#### Scenario: Verification records when it decided

- **WHEN** a company verdict is derived
- **THEN** the company records the verdict and the time it was derived

### Requirement: Verification goes stale and is re-checked

The system SHALL treat a verdict older than a configured staleness window as stale, SHALL be able to list companies whose verdicts are stale, and SHALL replace a company's verdict when it is re-verified while retaining the earlier check records.

#### Scenario: A recent verdict is not stale

- **WHEN** a company was verified within the configured window
- **THEN** it is not listed as stale

#### Scenario: An old verdict is stale

- **WHEN** a company's verdict is older than the configured window
- **THEN** it appears in the stale list
- **AND** downstream consumers can distinguish stale from current

#### Scenario: Re-verification retains history

- **WHEN** a company is re-verified
- **THEN** the new check records are stored alongside the earlier ones
- **AND** the company's verdict reflects the most recent run

#### Scenario: A company that stopped answering becomes unreachable

- **WHEN** a previously verified company's website no longer responds and it is re-verified
- **THEN** its verdict changes and the change is visible with its date

### Requirement: Verification is polite and bounded

Every check SHALL be bounded by a timeout and SHALL issue at most the configured number of requests per company. Requests to a company's own infrastructure SHALL respect that host's `robots.txt` and SHALL be rate-limited per host. The system SHALL NOT attempt to defeat a block, a challenge or a rate limit.

#### Scenario: A hanging host does not hang verification

- **WHEN** a host accepts a connection and does not respond
- **THEN** the check returns unknown within its configured timeout

#### Scenario: A blocked request ends the check

- **WHEN** a host responds with a block or a challenge
- **THEN** the check returns unknown recording that it was blocked
- **AND** no attempt is made to disguise the request or solve the challenge

#### Scenario: Requests to one host are spaced

- **WHEN** several companies share a host
- **THEN** requests to that host are spaced by the configured interval

### Requirement: Verification reports on a batch honestly

The system SHALL accept a batch of companies and SHALL report per company the verdict reached and the checks that produced it. A batch SHALL continue past an individual company's failure, and the report SHALL distinguish companies verified, unverified, unreachable and errored.

#### Scenario: One company's failure does not end the batch

- **WHEN** verifying one company in a batch raises an error
- **THEN** the remaining companies are still verified
- **AND** the report records that company as errored with its reason

#### Scenario: The batch report separates the four outcomes

- **WHEN** a batch completes
- **THEN** its report gives counts for verified, unverified, unreachable and errored

