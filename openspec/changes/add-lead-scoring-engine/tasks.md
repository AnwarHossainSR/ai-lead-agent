# Tasks — Add Lead Scoring Engine

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Scoring configuration

- [ ] 1.1 Add a weight version and a fingerprint of the weight values to `packages/config`, with load-time validation failing when the values do not match the fingerprint for that version
- [ ] 1.2 Add per-component scoring rules as validated configuration: thresholds, bands or point allocations, plus the unknown ceiling for each component
- [ ] 1.3 Add load-time validation rejecting overlapping bands and rules that can produce a value outside 0 to 100
- [ ] 1.4 Add the target business profile configuration used by the business-fit component
- [ ] 1.5 Add the configured technologies the operator sells against, used by the technology-fit component
- [ ] 1.6 Add unit tests covering every scenario in `specs/product-configuration/spec.md`
- [ ] 1.7 Verify: `pnpm --filter @mela/config lint typecheck test` passes

## 2. Schema

- [ ] 2.1 Add the `lead_score_snapshots` table with the explanation and total-range `CHECK`s and the `(lead_id, created_at DESC)` index
- [ ] 2.2 Add the constraint refusing a snapshot whose total does not equal its weighted components
- [ ] 2.3 Add `weight_version` and `scored_at` to `leads` with the index supporting the stale query
- [ ] 2.4 Add `updateLeadScore` writing only the score columns, weight version and scored time, with no status parameter, and refusing a write that carries one
- [ ] 2.5 Add `listStaleLeads` and a snapshot comparison read helper
- [ ] 2.6 Generate and commit the migration; confirm `pnpm db:check` reports no drift
- [ ] 2.7 Add integration tests covering every scenario in `specs/lead-data-model/spec.md`, including raw `INSERT`s that bypass the helpers
- [ ] 2.8 Verify: `pnpm --filter @mela/database lint typecheck test` passes with the Compose stack running

## 3. Evidence gathering

- [ ] 3.1 Implement the read that assembles a company's `CompanyEvidence`: latest completed analysis, its detections, current opportunities, contacts and company attributes
- [ ] 3.2 Return the evidence with stable identifiers so a snapshot can record exactly what it used
- [ ] 3.3 Refuse scoring with a stated reason when no component has any input
- [ ] 3.4 Add integration tests: a company with partial evidence, one with complete evidence, one with none
- [ ] 3.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 4. The five scorers

- [ ] 4.1 Define the `Scorer` type returning value, reasons and missing inputs, and the load-time check that configured weights and implemented scorers match exactly
- [ ] 4.2 Implement the website quality scorer over the four measured scores and the observation set
- [ ] 4.3 Implement the technology fit scorer over detections matched against the configured technologies, counting inferred detections separately from observed
- [ ] 4.4 Implement the opportunity strength scorer over accepted opportunities and their categories
- [ ] 4.5 Implement the contact reachability scorer over contact count, seniority rank and deliverability
- [ ] 4.6 Implement the business fit scorer over industry, country, city and company size against the target profile
- [ ] 4.7 Add unit tests per scorer against evidence fixtures, including all-missing, partially-missing and complete
- [ ] 4.8 Add a test asserting every scorer is pure: no clock, no randomness, no I/O
- [ ] 4.9 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 5. Composition and explanation

- [ ] 5.1 Implement the composer applying the configured weights, capping components with missing inputs at their unknown ceiling and recording the absence
- [ ] 5.2 Derive the total from the weighted components and the priority through the existing `classifyPriority`, refusing a caller-supplied total or priority
- [ ] 5.3 Implement the explanation formatter reading the same `ComponentResult`s, naming each component's value, weight, contribution, driving evidence and missing inputs
- [ ] 5.4 Add snapshot tests of the formatter and a determinism test asserting byte-identical explanations for identical evidence
- [ ] 5.5 Add unit tests for the boundary totals 90, 89, 80, 79, 70 and 69 classifying to the documented bands
- [ ] 5.6 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 6. Scoring service and API

- [ ] 6.1 Implement the scoring service: gather evidence, run the scorers, compose, persist the snapshot, create or update the lead
- [ ] 6.2 Confirm a first score creates the lead at the initial status and a later score leaves an advanced status untouched
- [ ] 6.3 Implement recomputation from a snapshot's recorded evidence identifiers, reporting evidence that no longer exists
- [ ] 6.4 Implement batch scoring continuing past an individual failure and reporting scored, refused and errored counts
- [ ] 6.5 Add `POST /api/companies/:id/score`, `POST /api/scoring/batch`, `GET /api/leads/:id/score`, `GET /api/leads/:id/score/history` and `GET /api/leads` filtered by priority and ordered by score
- [ ] 6.6 Add a test asserting no code path in the module calls a language model
- [ ] 6.7 Add API and integration tests covering every remaining scenario in `specs/lead-scoring/spec.md`, including the recomputation equality test
- [ ] 6.8 Verify: `pnpm --filter @mela/api lint typecheck test build` passes

## 7. Documentation and final verification

- [ ] 7.1 Document scoring in `docs/architecture.md`, including why the explanation is assembled rather than written and why missing evidence is capped rather than zeroed
- [ ] 7.2 Add `docs/scoring.md`: the five components, how to tune a rule, and why the weight version must be incremented
- [ ] 7.3 Update `docs/data-model.md` and `docs/implementation-progress.md`
- [ ] 7.4 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 7.5 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 7.6 Run `openspec validate add-lead-scoring-engine --strict` and resolve anything it reports
