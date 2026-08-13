# Lead Scoring

## Overview

Lead scoring turns a company's gathered evidence into a weighted, explained, reproducible score and priority. Every part of scoring is deterministic code: no language model is consulted, and the same evidence with the same weights always produces the same result.

## Evidence inputs

Scoring consumes the evidence already gathered by earlier modules:

- website analysis (`packages/database/src/write/website-analysis.ts`)
- technology detections (`packages/database/src/write/technology-detections.ts`)
- opportunity analysis (`packages/database/src/write/opportunity-read-helpers.ts`)
- contact research (`packages/database/src/write/contacts.ts`)
- company attributes (`companies` table)

The read helper `gatherCompanyEvidence` assembles these in one pass and returns a `CompanyEvidence` record plus stable identifiers (`CompanyEvidenceIdentifiers`). If none of these sources contain any data, scoring is refused with `NoEvidenceForScoringError` rather than inventing a value.

## Configuration

Scoring configuration lives in `packages/config/src/product/lead-scoring.ts`:

- `SCORE_COMPONENTS` — five components whose maximums sum to 100:
  - `business_fit` (30)
  - `technical_opportunity` (30)
  - `business_opportunity` (20)
  - `decision_maker_found` (10)
  - `company_quality` (10)
- `DEFAULT_COMPONENT_RULES` — per-component threshold bands and `unknownCeiling`
- `DEFAULT_BUSINESS_FIT_PROFILE` — target industries, countries, cities and company sizes
- `CONFIGURED_TECHNOLOGIES` — 18 technologies the operator sells against
- `DEFAULT_WEIGHT_VERSION` — version + fingerprint tied to the configured weights

Changing any component maximum without incrementing `DEFAULT_WEIGHT_VERSION.version` causes `validateWeightVersion` to throw at load time.

## Scorers

Each component has a pure scorer in `apps/api/src/scoring/scorers/`:

| Scorer | File | What it measures |
|--------|------|------------------|
| Website quality | `website-quality.scorer.ts` | Lighthouse average + observations |
| Technology fit | `technology-fit.scorer.ts` | Detections matched against `CONFIGURED_TECHNOLOGIES` |
| Opportunity strength | `opportunity-strength.scorer.ts` | Count of accepted opportunities |
| Contact reachability | `contact-reachability.scorer.ts` | Contact count + seniority + deliverability |
| Business fit | `business-fit.scorer.ts` | Industry, country, city, size vs `DEFAULT_BUSINESS_FIT_PROFILE` |

Scorers are registered through `registerScorer()` in `apps/api/src/scoring/scorer.ts`. At load time `validateScorersMatchWeights()` asserts that every configured component has a scorer and every scorer has a configured component.

## Composition

`apps/api/src/scoring/composer.ts` runs every registered scorer, caps missing components at their `unknownCeiling`, sums the contributions, clamps the total to 0–100, and derives priority through `classifyPriority`.

## Explanation

`apps/api/src/scoring/formatter.ts` assembles a human-readable explanation from the same values the score used. Every component's contribution, reasons and missing inputs are included. A blank explanation is rejected by the database constraint on `leads.score_explanation`.

## API

Endpoints are defined in `apps/api/src/scoring/scoring.controller.ts`:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/companies/:id/score` | Score one company |
| `POST` | `/api/scoring/batch` | Score up to 100 companies |
| `GET` | `/api/leads/:id/score` | Latest score for a lead |
| `GET` | `/api/leads/:id/score/history` | Snapshot history with diffs |
| `GET` | `/api/leads` | List leads with optional filters |

The scoring service (`apps/api/src/scoring/scoring.service.ts`) enforces the rule that the first score creates a lead at the configured initial status, and later scores update the score without resetting the status.

## Snapshots

Every score is persisted through `insertLeadScoreSnapshot` in `packages/database/src/write/scoring.ts`. The snapshot stores component values, total, priority, explanation, weight version, and JSON-stringified evidence identifiers. `compareSnapshots` reports which components changed between two snapshots.

## Staleness

`listStaleLeads` returns leads whose `weightVersion` is older than the current version. The database index `leads_weight_version_idx` supports this query without a full scan.

## Purity guarantee

`apps/api/src/scoring/no-model-call.test.ts` asserts that the scoring module contains no references to `@mela/ai`, `AIService`, `GeminiProvider`, or any HTTP client. Scoring is purely deterministic computation.
