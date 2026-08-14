## Purpose

Lets an operator start the whole lead pipeline from the product and watch it
work: one control that carries companies from discovery through verification,
analysis, scoring and drafting, reports honestly what each stage did and what
it failed to do, stops at the ceilings the run declared, and never proceeds
past the point where a person must approve.

## ADDED Requirements

### Requirement: Starting a run

An operator SHALL be able to start a pipeline run from the web application by
choosing a territory, an industry and a candidate limit. The system SHALL
record what was requested before any work begins, so a run that fails
immediately is still visible as something that was attempted.

#### Scenario: A run is started

- **WHEN** an operator submits a country, an industry and a candidate limit
- **THEN** a pipeline run is recorded with those parameters and reported back
  as started, and it appears in the list of runs

#### Scenario: A viewer cannot start a run

- **WHEN** an account whose role is viewer opens the pipeline page
- **THEN** the control that starts a run is unavailable to them, and an
  attempt to start one anyway is refused

#### Scenario: The request is checked before work begins

- **WHEN** a run is requested with a territory or industry that is not
  configured
- **THEN** it is refused with a message naming the configured values, and no
  run record and no jobs are created

### Requirement: A run refuses rather than succeeding emptily

A run SHALL NOT report success when it had no usable discovery source. If every
configured source is disabled, unreachable or unconfigured, the run SHALL end
in a stated failure naming which sources were unavailable and why.

#### Scenario: No source is usable

- **WHEN** a run starts and no discovery source is both enabled and configured
- **THEN** the run ends as failed, names each source and the reason it could
  not be used, and does not report a completed run that stored zero companies

#### Scenario: One source of several is unavailable

- **WHEN** one source is unusable and another returns candidates
- **THEN** the run proceeds, and its per-source report shows one skipped with
  its reason alongside the one that ran

### Requirement: Stages proceed automatically

Completing a stage SHALL carry the companies that passed it into the next
stage without a person deciding to make it happen. A company that fails a stage
SHALL NOT be carried forward, and the failure SHALL be recorded against that
company with its reason.

#### Scenario: A verified company proceeds to analysis

- **WHEN** verification completes and marks a company verified
- **THEN** website analysis is enqueued for that company without further
  operator action

#### Scenario: A company that fails a stage stops there

- **WHEN** a company's website analysis fails
- **THEN** that company does not proceed to technology detection, the failure
  and its reason are recorded against it, and every other company in the run
  continues

### Requirement: The chain stops at human approval

The pipeline SHALL end at a drafted message awaiting approval. No stage, and no
configuration of a run, SHALL cause a message to be approved, sent, or marked
sent.

#### Scenario: The final stage produces a draft, not a send

- **WHEN** a run reaches outreach drafting and completes it
- **THEN** the message is recorded as a draft awaiting approval, nothing is
  transmitted, and the run reports itself complete with the draft waiting

#### Scenario: No option exists to send automatically

- **WHEN** the options available when starting a run are enumerated
- **THEN** none of them causes approval or transmission

### Requirement: Ceilings a person set

A run SHALL declare a maximum number of companies and a maximum model spend
before it begins. On reaching either, the run SHALL stop and report which
ceiling it reached, rather than continuing.

#### Scenario: The company ceiling is reached

- **WHEN** a run reaches the number of companies it declared
- **THEN** it stops enqueuing further work and reports that it stopped at the
  company ceiling, and the work already completed remains

#### Scenario: The spend ceiling is reached

- **WHEN** the model spend attributable to a run reaches the ceiling it
  declared
- **THEN** the run stops before making a further model call and reports that it
  stopped at the spend ceiling

### Requirement: Progress is visible and honest

While a run is in progress, the system SHALL report per stage how many
companies have completed it, how many are in flight, and how many failed. A
count SHALL never be presented as complete while work is still in flight, and a
stage that has not run SHALL be distinguishable from one that ran and produced
nothing.

#### Scenario: Progress updates without a manual refresh

- **WHEN** an operator is viewing a run that is in progress
- **THEN** the per-stage counts update as work completes, without the operator
  reloading the page

#### Scenario: Not-yet-run is distinguishable from produced-nothing

- **WHEN** a stage has not started, and another stage ran and found nothing
- **THEN** the two are presented differently, and neither is shown as a plain
  zero

#### Scenario: A finished run states how it finished

- **WHEN** a run reaches its end
- **THEN** it reports which of completed, stopped-at-a-ceiling or failed
  describes it, and in the last case the reason

### Requirement: Re-running one stage for one company

An operator SHALL be able to re-run a single stage for a single company without
starting a new run and without repeating the stages that already succeeded.

#### Scenario: Re-running a failed analysis

- **WHEN** an operator re-runs website analysis for a company whose analysis
  failed
- **THEN** only that stage runs for that company, its previous failure remains
  recorded, and on success the company proceeds to the following stage

#### Scenario: A viewer cannot re-run a stage

- **WHEN** an account whose role is viewer views a company with a failed stage
- **THEN** the re-run control is unavailable to them

### Requirement: Work is not duplicated

Enqueuing the same stage for the same company twice SHALL result in that work
being done once. A stage that already holds a current result for a company
SHALL be skipped rather than repeated, unless it was explicitly re-run.

#### Scenario: The same run is started twice

- **WHEN** an operator starts a second run with the same territory and industry
  while the first is still in progress
- **THEN** a company already in flight is not processed twice by the same stage

#### Scenario: An explicit re-run is honoured

- **WHEN** an operator explicitly re-runs a stage that already has a result
- **THEN** the stage runs and produces a new result, because the operator asked
  for it rather than a chain reaching it

### Requirement: A run records what it did

Every run SHALL retain, after it ends, the parameters it was given, which
sources ran and with what outcome, how many companies reached each stage, what
failed and why, and the model spend it incurred.

#### Scenario: A finished run is inspectable

- **WHEN** an operator opens a run that finished days ago
- **THEN** its parameters, per-source outcomes, per-stage counts, failures and
  spend are all still readable

#### Scenario: Starting a run is auditable

- **WHEN** an operator starts a run
- **THEN** an audit entry records which account started it and with what
  parameters
