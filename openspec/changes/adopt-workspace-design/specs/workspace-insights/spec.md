## Purpose

The aggregate reads behind the dashboard, analytics, operations and status
screens — headline counts with a real trend, stage funnels, activity, attention,
spend and dependency history — and the rules that keep a summary from implying
more than the underlying rows support.

## ADDED Requirements

### Requirement: A headline count carries its own trend

A headline count SHALL be returned with the equivalent count for the preceding
period of the same length and with a series covering the current period, so a
delta and a trend are computed from data rather than illustrated. Where no
preceding period exists, the response SHALL say so and SHALL NOT report a change.

#### Scenario: A count is returned with its comparison

- **WHEN** the dashboard summary is requested
- **THEN** each headline figure carries its current value, the preceding period's
  value, and the per-day series that produced it

#### Scenario: The first period has nothing to compare against

- **WHEN** the preceding period contains no data because the workspace is new
- **THEN** the response marks the comparison unavailable, and the interface shows
  no delta rather than a change from zero

#### Scenario: A partial series is declared partial

- **WHEN** the series covers fewer days than the requested window because
  recording began inside it
- **THEN** the response states the first day it holds, and the interface says the
  trend covers a shorter period

### Requirement: The funnel counts companies by the furthest stage they reached

The system SHALL report, for each pipeline stage, how many companies have reached
it. A stage that has never run SHALL be reported as not run, distinctly from a
stage that ran and carried no company forward.

#### Scenario: Stages report their counts

- **WHEN** the funnel is requested
- **THEN** every stage in the configured chain appears, in order, with the number
  of companies that reached it

#### Scenario: A stage that never ran is not a zero

- **WHEN** a stage has never been executed for any company
- **THEN** it is reported as not yet run, and is not reported as having zero
  companies

#### Scenario: The funnel does not exceed its source

- **WHEN** the funnel is compared against the companies table
- **THEN** no stage reports more companies than exist

### Requirement: Recent activity is drawn from what was recorded, not narrated

The activity feed SHALL be assembled from the audit trail and stage records, and
each entry SHALL name what happened, what it happened to, when, and — where an
account caused it — who. An entry SHALL NOT be synthesised for an event that was
not recorded.

#### Scenario: An action is attributed

- **WHEN** an operator approves a draft
- **THEN** the activity feed shows the approval, the draft's company, the time,
  and the account that did it

#### Scenario: A system event has no actor

- **WHEN** a stage fails without a person involved
- **THEN** the entry records the failure and its reason, and shows no account
  rather than attributing it to the signed-in one

### Requirement: Attention is one list of things a person must do

The system SHALL return, as a single ordered list, the items requiring a person:
drafts awaiting review, stages that failed and can be re-run, and leads whose
data has gone stale. Each item SHALL carry its count and the destination that
resolves it.

#### Scenario: Items are actionable

- **WHEN** the attention list is requested
- **THEN** each item states how many, what kind, and where to go to deal with it

#### Scenario: Nothing needs attention

- **WHEN** no drafts wait, no stage has failed and nothing is stale
- **THEN** the list is returned empty and the interface says the workspace is
  clear, rather than showing an empty container

### Requirement: Analytics series report their sample size

Each analytics series SHALL carry the number of underlying records it summarises,
and SHALL mark any bucket whose sample is below the configured minimum. A rate
computed from a sample below that minimum SHALL be returned as unavailable rather
than as a number.

#### Scenario: A small bucket is marked

- **WHEN** a bucket summarises fewer records than the configured minimum
- **THEN** it is marked as below the minimum sample size, and the interface
  presents it distinctly from a bucket that is not

#### Scenario: A rate is withheld rather than misleading

- **WHEN** a response rate would be computed from fewer records than the minimum
- **THEN** the rate is returned as unavailable, and the count it would have been
  derived from is still returned

#### Scenario: An empty window is empty, not zero

- **WHEN** a requested window contains no records at all
- **THEN** the series states that the window held no records, rather than
  returning a series of zeroes

### Requirement: Spend is reported against the ceiling that governs it

The system SHALL report model spend for a period broken down by stage, together
with the ceiling in force, so a figure is readable as a proportion of what is
permitted rather than as an unanchored amount.

#### Scenario: Spend is anchored

- **WHEN** operations spend is requested
- **THEN** the response carries the amount spent, the period it covers, the
  ceiling in force, and the amount remaining

#### Scenario: Spend is attributed by stage

- **WHEN** spend is requested broken down
- **THEN** each stage that invoked a model reports its own amount, and stages
  that invoked none are reported as having made no calls

### Requirement: Dependency health history shows only what was sampled

The system SHALL record the reachability of each external dependency on a
schedule and SHALL return that history for display. The history SHALL state the
earliest sample it holds, and a period before sampling began SHALL be presented
as unrecorded rather than as healthy.

#### Scenario: History reflects real samples

- **WHEN** dependency history is requested
- **THEN** each returned interval corresponds to a recorded sample, with its
  status

#### Scenario: The unsampled past is not filled in

- **WHEN** the requested window reaches further back than the earliest sample
- **THEN** the earlier part of the window is returned as unrecorded, and the
  interface presents it differently from a healthy period

#### Scenario: A gap in sampling is visible

- **WHEN** sampling stopped for a period and later resumed
- **THEN** the gap is returned as unrecorded rather than interpolated from the
  samples on either side

### Requirement: Aggregate reads do not require an operator

Every read in this capability SHALL be available to any signed-in account
regardless of role, and SHALL NOT expose credentials, request payloads or any
value the redaction rules withhold from logs.

#### Scenario: A viewer sees the workspace

- **WHEN** an account whose role is viewer requests any aggregate read
- **THEN** the request succeeds

#### Scenario: A signed-out request is refused

- **WHEN** an unauthenticated request is made to any aggregate read
- **THEN** it is refused, and no counts are returned
