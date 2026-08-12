# Implementation Progress

## Current Status

**`add-company-verification` complete (43/43 tasks).** Verification rule configuration, schema, write path, HTTP politeness, checks, registry, verdict derivation, service and API are all implemented and tested.

**`add-company-discovery` complete (52/52 tasks).** Source configuration, database schema, file-import adapter, places adapter, rate limiting, deduplication, run orchestration, API surface, and documentation are all implemented and tested.

**`add-website-analysis` complete (55/55 tasks).** Configuration, schema, fixture site, browser capture, artifacts, observation rules, politeness, API endpoints, and documentation are all implemented and tested. 275 API tests passing.

**`add-technology-detection` in progress (50/65 tasks).** Fingerprint configuration, database schema, matcher service, implications, and integration with analysis are implemented. Documentation and final verification remain.

**Pipeline: not started.** Fifteen more changes are planned and validated in `openspec/changes/`.
None has been applied.

## Completed

### bootstrap-project-foundation — archived 2026-08-11

Established the workspace and the three capabilities now live in `openspec/specs/`:

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `product-configuration` | countries, cities, industries, services, lead statuses and transitions, priority bands, scoring weights, outreach channels |
| `lead-data-model`       | companies, contacts, website analyses, leads, outreach — with provenance, evidence and controlled transitions              |
| `developer-environment` | workspace commands, containerised PostgreSQL and Redis, validated environment, health endpoint, CI, documentation          |

Delivered: pnpm + Turborepo monorepo; Docker Compose stack; `@mela/config`, `@mela/shared`,
`@mela/database`; NestJS API with a Terminus health endpoint; Next.js 16 web shell; GitHub
Actions running lint, typecheck, test and build with no deployment step.

### add-company-verification — completed 2026-08-12

Verification of discovered companies via deterministic checks and registry lookups.

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `company-verification`  | verification rule, checks (DNS, HTTP, domain-name-match, registry), verdict derivation, service, API endpoints             |
| `product-configuration` | verification rule config, politeness settings, registry configs                                                             |
| `lead-data-model`       | verification_checks table, verification enums, verification columns on companies                                           |

Delivered: Verification rule configuration with frozen validated data; database schema with evidence-required CHECK constraint; four deterministic checks with injected dependencies; pure `deriveState` function; `VerificationService` orchestrating checks and persisting results; three API endpoints for single/batch verification and state retrieval.

## Planned changes

Sixteen changes, all with proposal, spec deltas, design and tasks, all passing
`openspec validate --strict`. Arrows are hard dependencies.

### The pipeline, in order

| #   | Change                        | Depends on | Tasks |
| --- | ----------------------------- | ---------- | ----- |
| 1   | `add-ai-provider-abstraction` | —          | 39    |
| 2   | `add-company-discovery`       | —          | 52    |
| 3   | `add-company-verification`    | 2          | 43    |
| 4   | `add-website-analysis`        | 3          | 55    |
| 5   | `add-technology-detection`    | 4          | 44    |
| 6   | `add-opportunity-analysis`    | 1, 5       | 44    |
| 7   | `add-decision-maker-research` | 3, 4       | 49    |
| 8   | `add-lead-scoring-engine`     | 5, 6, 7    | 49    |
| 9   | `add-research-summary`        | 8          | 43    |
| 10  | `add-outreach-drafting`       | 9          | 43    |
| 11  | `add-outreach-tracking`       | 10         | 51    |

### Infrastructure and surface

| #   | Change                | Depends on                          | Tasks |
| --- | --------------------- | ----------------------------------- | ----- |
| 12  | `add-background-jobs` | 2–11                                | 52    |
| 13  | `add-dashboard`       | 8, 11                               | 50    |
| 14  | `add-authentication`  | — for the API; 13 for its UI half   | 51    |
| 15  | `add-observability`   | — for logging; 12 for queue metrics | 48    |
| 16  | `add-deployment`      | 14, 15                              | 55    |

### What can be built in parallel

- **1, 2, 14 and 15** have no dependency on each other and can start immediately.
- The chain **3 → 4 → 5** is strictly sequential.
- **6 and 7** can run in parallel once 4 is done.
- Everything from **8** onward is sequential.

## New capabilities these changes introduce

`ai-provider`, `company-discovery`, `company-verification`, `website-analysis-pipeline`,
`technology-detection`, `opportunity-analysis`, `decision-maker-research`, `lead-scoring`,
`research-summary`, `outreach-drafting`, `outreach-tracking`, `background-jobs`, `dashboard`,
`authentication`, `observability`, `deployment`.

Each change also carries deltas against the three existing capabilities where it extends them.

## Constraints every change preserves

- **Human approval before any outreach.** No change adds a transport, a credential for a
  sending service, an endpoint that transmits, or a scheduler. `add-outreach-drafting` and
  `add-background-jobs` each carry a test asserting the absence.
- **Never fabricate.** Contact details are never constructed. Scores are never defaulted.
  Versions are never inferred. Model output must cite the evidence it was given.
- **Observed, inferred, unknown stay distinguishable** — in the schema, in the API and in the UI.
- **Deterministic code decides.** Scoring, deduplication, verdicts, transitions and validation
  contain no model call. The model interprets, summarizes, classifies and personalizes.
- **No anti-bot evasion.** A source that blocks us is recorded as blocked and left alone.

## Testing status — current build

| Package          | Test files | Tests | Status  |
| ---------------- | ---------- | ----- | ------- |
| `@mela/config`   | 12         | 169   | passing |
| `@mela/shared`   | 3          | 66    | passing |
| `@mela/database` | 7          | 132   | passing |
| `@mela/ai`       | 7          | 76    | passing |
| `@mela/api`      | 31         | 251   | passing |
| `@mela/web`      | 5          | —     | passing |

## Next step

Apply a change with `/opsx:apply <change-name>`. `add-ai-provider-abstraction`,
`add-company-discovery`, `add-authentication` and `add-observability` are all unblocked.
