## Purpose

Loads a company's website in a real browser, audits its quality, and records only what was actually observed — leaving unmeasured scores unmeasured, storing failures as failures rather than as bad results, and bounding every request so a hostile or broken site cannot hang the pipeline.

## ADDED Requirements

### Requirement: A score is stored only when it was measured

The system SHALL store a quality score only when the audit that produces it completed. When an audit does not run, fails, or returns no value for a category, the system SHALL leave that score unrecorded and SHALL NOT substitute zero, a default, or a value derived from any other signal.

#### Scenario: A completed audit stores its scores

- **WHEN** the audit completes for a reachable site
- **THEN** the analysis record carries the measured scores

#### Scenario: A failed audit stores no scores

- **WHEN** the audit fails to run
- **THEN** the analysis record carries no scores
- **AND** the record states why the audit did not produce them

#### Scenario: A missing category is not filled in

- **WHEN** the audit completes but returns no value for one category
- **THEN** that category's score is unrecorded while the others are stored

#### Scenario: Zero is distinguishable from unmeasured

- **WHEN** an analysis with no measured scores and an analysis with a measured score of zero are read
- **THEN** the two are distinguishable

### Requirement: Every observation carries what was seen and where

The system SHALL record each finding as an observation carrying a description of what was observed, the URL it was observed at, the time of observation, and a certainty of observed. The system SHALL NOT record a finding it did not directly observe, and SHALL NOT infer a finding from the absence of evidence.

#### Scenario: An observation carries its evidence

- **WHEN** the analysis finds that a site is served without HTTPS
- **THEN** an observation is recorded with that description, the URL and the observation time

#### Scenario: An unobservable property produces no observation

- **WHEN** a page could not be loaded
- **THEN** no observations about that page's content are recorded

#### Scenario: Observations are marked as observed, never inferred

- **WHEN** observations from an analysis are read
- **THEN** each carries a certainty of observed

### Requirement: Analysis is bounded and cannot hang the pipeline

The system SHALL bound each analysis by a navigation timeout, a total run timeout and a maximum page weight, each configurable. Exceeding any limit SHALL end the analysis with a recorded reason naming the limit, retaining whatever was captured before it.

#### Scenario: A site that never finishes loading is abandoned

- **WHEN** a page does not reach its load condition within the navigation timeout
- **THEN** the analysis ends with a reason naming the navigation timeout

#### Scenario: A slow overall run is abandoned

- **WHEN** an analysis exceeds the total run timeout
- **THEN** it ends with a reason naming the run timeout
- **AND** partial capture already recorded is retained

#### Scenario: An oversized page is abandoned

- **WHEN** a page exceeds the configured maximum weight
- **THEN** the analysis ends with a reason naming the weight limit

#### Scenario: The browser is always released

- **WHEN** an analysis ends for any reason including a crash
- **THEN** the browser context is closed and no process is left running

### Requirement: Analysis is polite and never evasive

Before requesting a page the system SHALL evaluate the host's `robots.txt` and SHALL NOT request a disallowed path. It SHALL identify itself with a stable, honest user agent, SHALL rate-limit requests per host, and SHALL abandon a host that blocks it. The system SHALL NOT disguise its requests, alter its browser fingerprint to evade detection, solve a challenge, or route around a block.

#### Scenario: A disallowed path is not requested

- **WHEN** a host's `robots.txt` disallows the path the analysis would request
- **THEN** no request is made
- **AND** the analysis is recorded as skipped with that reason

#### Scenario: A blocking host ends the analysis

- **WHEN** a host responds with a block or a bot challenge
- **THEN** the analysis ends recorded as blocked with no scores
- **AND** no attempt is made to disguise the request or solve the challenge

#### Scenario: The user agent is honest and stable

- **WHEN** the analysis requests a page
- **THEN** it sends a user agent identifying the tool
- **AND** that value does not vary between requests to evade detection

### Requirement: A failed analysis is a recorded outcome, not an absence

The system SHALL record an analysis for every attempt, including failures, carrying an outcome that distinguishes completed, partially completed, blocked, skipped and failed, together with a reason. A company that could not be analysed SHALL be distinguishable from one that has never been attempted.

#### Scenario: A failure produces a record

- **WHEN** an analysis fails
- **THEN** an analysis record exists with a failed outcome and a reason

#### Scenario: Never attempted differs from failed

- **WHEN** a company that has never been analysed and one whose analysis failed are compared
- **THEN** the two are distinguishable

#### Scenario: A partial capture is marked partial

- **WHEN** the page capture succeeds and the audit fails
- **THEN** the outcome is partially completed with the capture retained and no scores

### Requirement: Only verified, website-bearing companies are analysed

The system SHALL refuse to analyse a company with no website, and SHALL refuse to analyse a company whose verification state is not verified unless explicitly overridden by the caller. A refusal SHALL name the reason and SHALL NOT create an analysis record.

#### Scenario: A company without a website is refused

- **WHEN** analysis is requested for a company with no website
- **THEN** the request is refused naming the missing website
- **AND** no analysis record is created

#### Scenario: An unverified company is refused by default

- **WHEN** analysis is requested for a company that is not verified and no override is given
- **THEN** the request is refused naming the verification state

#### Scenario: An override is honoured and recorded

- **WHEN** analysis is requested for an unverified company with an explicit override
- **THEN** the analysis proceeds
- **AND** the record notes that it ran against an unverified company

### Requirement: The latest analysis is unambiguous

The system SHALL retain every analysis and SHALL identify the most recent one for a company deterministically, breaking ties by a stable identifier so two analyses recorded in the same instant do not swap places between reads.

#### Scenario: The most recent analysis is returned

- **WHEN** a company has several analyses and the latest is requested
- **THEN** the most recently created one is returned

#### Scenario: A tie resolves the same way every time

- **WHEN** two analyses share a creation timestamp and the latest is requested repeatedly
- **THEN** the same one is returned each time

#### Scenario: A failed later analysis does not hide an earlier success

- **WHEN** a company's most recent analysis failed and an earlier one succeeded
- **THEN** both are retrievable and the failed one is identified as the latest
