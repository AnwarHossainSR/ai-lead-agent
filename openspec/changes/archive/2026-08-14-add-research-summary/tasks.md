# Tasks — Add AI Research Summary

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Schema

- [ ] 1.1 Add the `lead_research_summaries` table with the always-true `is_generated` `CHECK`, the citation `CHECK`, and `ON DELETE RESTRICT` on the invocation reference
- [ ] 1.2 Add the `(lead_id, created_at DESC, id DESC)` index so the current-summary tie-break is deterministic
- [ ] 1.3 Add write helpers storing a summary and reading a lead's current summary and history
- [ ] 1.4 Generate and commit the migration; confirm `pnpm db:check` reports no drift
- [ ] 1.5 Add integration tests covering every scenario in `specs/lead-data-model/spec.md`, including raw `INSERT`s that bypass the helpers
- [ ] 1.6 Verify: `pnpm --filter @mela/database lint typecheck test` passes with the Compose stack running

## 2. Prohibited claim configuration

- [ ] 2.1 Add the prohibited-claim categories and their patterns to `packages/config` as validated data, covering finance, size, hiring, trajectory, plans and customers
- [ ] 2.2 Add load-time validation for invalid patterns and catastrophic backtracking
- [ ] 2.3 Add unit tests with positive and negative cases per category, including the company-size exemption case
- [ ] 2.4 Verify: `pnpm --filter @mela/config lint typecheck test` passes

## 3. The prompt

- [ ] 3.1 Add the research summary prompt to `packages/ai` at version 1 with the five-section claim schema
- [ ] 3.2 Instruct the model to cite every claim and to make no assertion about finances, headcount, hiring or plans
- [ ] 3.3 Confirm the output schema has no field for an unknown list, since the platform derives it
- [ ] 3.4 Add unit tests: rendering keeps instructions and input separate, and stored text containing instruction-like content stays inside the input block
- [ ] 3.5 Verify: `pnpm --filter @mela/ai lint typecheck test` passes

## 4. Input assembly

- [ ] 4.1 Build the model input from the lead's stored company attributes, observations, detections, opportunities, contacts, score components and explanation, minting call-local references
- [ ] 4.2 Refuse generation for a company with no lead or an unscored lead, naming the reason and making no model call
- [ ] 4.3 Add a test asserting no retrieval, fetch or search occurs during generation
- [ ] 4.4 Add a test asserting no other company's data appears in the input
- [ ] 4.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 5. Grounding and screening

- [ ] 5.1 Implement the post-parse citation check against the supplied reference set, removing and counting uncited and fabricated-citation claims
- [ ] 5.2 Implement the prohibited-claim screen over parsed claim text, removing and counting matches by category
- [ ] 5.3 Implement the company-size exemption for a claim whose citation resolves to the stored company size
- [ ] 5.4 Implement the all-rejected path: store no summary, record a failed run with the rejection counts
- [ ] 5.5 Resolve call-local references back to real identifiers before storing
- [ ] 5.6 Add unit tests against the fake provider for every rejection and screening path
- [ ] 5.7 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 6. Derived unknown list

- [ ] 6.1 Implement the unknown-list derivation from the lead's own record: absent company size, description, contact email, completed analysis, opportunities and stale verification
- [ ] 6.2 Attach it to the summary after generation, never taking it from the model
- [ ] 6.3 Add unit tests: a lead missing several facts lists all of them, a complete lead has an empty list rather than an omitted one
- [ ] 6.4 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 7. Service and API

- [ ] 7.1 Implement the summary service: assemble input, call `AIService`, enforce grounding and screening, derive the unknown list, persist
- [ ] 7.2 Implement regeneration retaining history, with a failed regeneration leaving the previous summary current
- [ ] 7.3 Add `POST /api/leads/:id/summary`, `GET /api/leads/:id/summary` and `GET /api/leads/:id/summary/history`, returning the generated marking with every read
- [ ] 7.4 Add API tests covering every remaining scenario in `specs/research-summary/spec.md`
- [ ] 7.5 Confirm no test calls a real provider
- [ ] 7.6 Verify: `pnpm --filter @mela/api lint typecheck test build` passes

## 8. Documentation and final verification

- [ ] 8.1 Document the module in `docs/architecture.md`, including why the unknown list is derived rather than generated and what the prohibited-claim screen does and does not guarantee
- [ ] 8.2 Document the prompt in `docs/ai-prompts.md`
- [ ] 8.3 Update `docs/data-model.md` and `docs/implementation-progress.md`
- [ ] 8.4 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 8.5 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 8.6 Run `openspec validate add-research-summary --strict` and resolve anything it reports
