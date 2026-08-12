# Tasks — Add Decision Maker Research

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Configuration

- [x] 1.1 Add seniority levels to `packages/config` with unique identifiers, display names and ranks, validated for duplicate identifiers and duplicate ranks
- [x] 1.2 Add role patterns mapping stated job titles to levels, including Arabic and English variants, validated for invalid patterns and unknown levels
- [x] 1.3 Add the configured conventional paths contact research may request
- [x] 1.4 Add a test asserting the contact research configuration schema contains no email pattern, address template or permutation field
- [x] 1.5 Add unit tests covering every scenario in `specs/product-configuration/spec.md`
- [x] 1.6 Verify: `pnpm --filter @mela/config lint typecheck test` passes

## 2. Schema

- [x] 2.1 Add the `contact_extraction_method`, `mail_deliverability` and `contact_research_outcome` enums
- [x] 2.2 Add `extraction_method` (NOT NULL, no default), `seniority_id`, `role_source_url`, `mail_deliverability` and `ai_invocation_id` to `contacts`, with the interpreted-requires-invocation and seniority-requires-title `CHECK`s
- [x] 2.3 Add the `contact_research_runs` table with its cascade delete
- [x] 2.4 Update the existing contact write helpers for the new required column, and add a helper deleting all contacts for a company
- [x] 2.5 Generate and commit the migration; confirm `pnpm db:check` reports no drift
- [x] 2.6 Add integration tests covering every scenario in `specs/lead-data-model/spec.md`, including that the existing source-URL constraint still refuses a sourceless detail
- [x] 2.7 Verify: `pnpm --filter @mela/database lint typecheck test` passes with the Compose stack running

## 3. Deterministic extraction

- [x] 3.1 Implement the `mailto:` and `tel:` extractor over captured page content, recording the page URL as the source
- [x] 3.2 Implement the structured-data extractor for `schema.org` `Person` and `Organization` markup
- [x] 3.3 Implement the visible-address extractor with a strict pattern over rendered text, storing the address at the domain it actually has
- [x] 3.4 Add unit tests per extractor against HTML fixtures, including an address at a different domain from the company's
- [x] 3.5 Add the source-scan test asserting no function derives an address from a name and a domain
- [x] 3.6 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 4. Page fetching

- [x] 4.1 Reuse pages already captured by website analysis before requesting anything new
- [x] 4.2 Fetch the configured conventional paths through the shared `robots.txt` evaluator and per-host limiter, recording each skip with its reason
- [x] 4.3 End research for a company recorded as blocked when a host blocks, with no retry and no disguise
- [x] 4.4 Add a test asserting the only URLs requested are the analysed pages and the configured paths
- [x] 4.5 Add integration tests against the fixture site for the disallowed and blocked cases
- [x] 4.6 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 5. People extraction by model

- [x] 5.1 Add the people-extraction prompt to `packages/ai` at version 1, with an output schema containing no email or telephone field
- [x] 5.2 Add a schema-shape test asserting the key set contains no contact detail field
- [x] 5.3 Implement the `namingText` grounding check requiring the quoted text to occur in the supplied page, discarding and counting people who fail it
- [x] 5.4 Discard any value resembling an email address appearing in a name or role field
- [x] 5.5 Record interpreted contacts as inferred with the invocation referenced
- [x] 5.6 Add unit tests against the fake provider for the grounding check, the discarded-address case and the no-people-found branch
- [x] 5.7 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 6. Seniority and deliverability

- [x] 6.1 Implement seniority classification against the configured patterns, yielding unknown on no match and refusing a seniority with no title
- [x] 6.2 Implement the MX-only deliverability check with per-domain caching, yielding unknown on lookup failure or timeout
- [x] 6.3 Add a test asserting no SMTP connection is opened and no message is sent anywhere in the module
- [x] 6.4 Confirm deliverability never filters an address out of storage
- [x] 6.5 Add unit tests for classification and for all three deliverability states
- [x] 6.6 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 7. Service and API

- [x] 7.1 Implement the research service: gather pages, run both extractors, merge results without duplicating a person, persist the run and its contacts
- [x] 7.2 Record the none-found outcome distinctly from blocked and failed
- [x] 7.3 Add `POST /api/companies/:id/contacts/research`, `GET /api/companies/:id/contacts`, `POST /api/companies/:id/contacts` for manual entry with a required source URL, and `DELETE /api/companies/:id/contacts`
- [x] 7.4 Add API tests covering every remaining scenario in `specs/decision-maker-research/spec.md`
- [x] 7.5 Verify: `pnpm --filter @mela/api lint typecheck test build` passes

## 8. Documentation and final verification

- [ ] 8.1 Document the module in `docs/architecture.md`, stating plainly that address guessing and SMTP probing are refused and why
- [ ] 8.2 Add `docs/contact-data.md`: what is collected, from where, how deletion works, and the manual entry path
- [ ] 8.3 Update `docs/data-model.md` and `docs/implementation-progress.md`
- [ ] 8.4 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 8.5 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 8.6 Run `openspec validate add-decision-maker-research --strict` and resolve anything it reports
