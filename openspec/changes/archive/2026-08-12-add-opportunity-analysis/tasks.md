# Tasks — Add Business Opportunity Analysis

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Configuration

- [ ] 1.1 Add the opportunity taxonomy to `packages/config`: categories with unique identifiers, display names and the configured service each maps to
- [ ] 1.2 Add load-time validation rejecting duplicate category identifiers and categories mapping to unknown services
- [ ] 1.3 Add `resolveOpportunityCategory` refusing an unknown identifier with a message listing the configured ones
- [ ] 1.4 Add the evidence threshold configuration: minimum observations, minimum detections, and whether a completed analysis is required, with non-negative validation
- [ ] 1.5 Add unit tests covering every scenario in `specs/product-configuration/spec.md`
- [ ] 1.6 Verify: `pnpm --filter @mela/config lint typecheck test` passes

## 2. Schema

- [ ] 2.1 Add the `opportunity_run_outcome` enum and the `opportunity_analysis_runs` table with the accepted-count `CHECK`
- [ ] 2.2 Add the `opportunities` table with the certainty, citation and non-blank `CHECK` constraints, and `ON DELETE RESTRICT` on the invocation reference
- [ ] 2.3 Add write helpers recording a run, storing accepted opportunities, and recording rejections by reason
- [ ] 2.4 Add read helpers returning a company's current opportunities and its run history
- [ ] 2.5 Generate and commit the migration; confirm `pnpm db:check` reports no drift
- [ ] 2.6 Add integration tests covering every scenario in `specs/lead-data-model/spec.md`, including raw `INSERT`s and an `UPDATE` attempting to set certainty to observed
- [ ] 2.7 Add a test asserting the persisted shape and its validation schema contain no quantified-impact field
- [ ] 2.8 Verify: `pnpm --filter @mela/database lint typecheck test` passes with the Compose stack running

## 3. The prompt

- [ ] 3.1 Add the opportunity analysis prompt to `packages/ai` at version 1, with its input type and the discriminated-union output schema
- [ ] 3.2 Structure the input as records rather than prose, each observation and detection carrying a short call-local reference
- [ ] 3.3 Include the configured service catalogue and taxonomy in the prompt, and instruct the model to cite evidence and to use the insufficient-evidence branch
- [ ] 3.4 Add a schema-shape test asserting the output schema's key set contains no monetary, percentage, duration or deal-size field
- [ ] 3.5 Add unit tests: rendering keeps instructions and input in separate blocks, and an observation containing instruction-like text stays inside the input block
- [ ] 3.6 Verify: `pnpm --filter @mela/ai lint typecheck test` passes

## 4. Input assembly

- [ ] 4.1 Build the model input from the company's latest completed analysis observations and technology detections, minting call-local references and retaining the map back to real identifiers
- [ ] 4.2 Omit attributes the platform holds as unknown rather than describing them as unknown
- [ ] 4.3 Add the threshold short-circuit recording a below-threshold outcome and making no model call
- [ ] 4.4 Add unit tests: only the subject company's evidence is present, unknown attributes are absent, every evidence item carries a reference, the threshold prevents any call
- [ ] 4.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 5. Grounding enforcement

- [ ] 5.1 Implement the post-parse citation check against the actual supplied reference set
- [ ] 5.2 Reject an opportunity with no citations, with an unknown citation, naming an unknown service, or with a blank field — each with its own recorded reason
- [ ] 5.3 Implement partial acceptance: store the valid opportunities, discard and count the invalid ones
- [ ] 5.4 Resolve call-local references back to real identifiers before storing
- [ ] 5.5 Add unit tests against the fake provider for every rejection path and for partial acceptance
- [ ] 5.6 Add the injection test asserting that instruction-like observation text cannot produce a stored opportunity with a fabricated citation
- [ ] 5.7 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 6. Service and API

- [ ] 6.1 Implement the analysis service: threshold check, input assembly, `AIService` call, grounding enforcement, persistence of the run and its opportunities
- [ ] 6.2 Record the insufficient-evidence outcome distinctly from a failure
- [ ] 6.3 Add `POST /api/companies/:id/opportunities/analyze`, `GET /api/companies/:id/opportunities` and `GET /api/companies/:id/opportunities/runs`
- [ ] 6.4 Add API tests covering every remaining scenario in `specs/opportunity-analysis/spec.md`
- [ ] 6.5 Confirm no test calls a real provider
- [ ] 6.6 Verify: `pnpm --filter @mela/api lint typecheck test build` passes

## 7. Documentation and final verification

- [ ] 7.1 Document the module in `docs/architecture.md`, including why grounding is enforced after parsing rather than requested in the prompt
- [ ] 7.2 Document the prompt and its versioning in `docs/ai-prompts.md`
- [ ] 7.3 Update `docs/data-model.md` and `docs/implementation-progress.md`
- [ ] 7.4 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 7.5 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 7.6 Run `openspec validate add-opportunity-analysis --strict` and resolve anything it reports
