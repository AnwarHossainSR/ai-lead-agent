# Tasks — Add Outreach Tracking and Evaluation

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Configuration

- [ ] 1.1 Add response categories to `packages/config` with unique identifiers, display names and the lead status transition each proposes
- [ ] 1.2 Add load-time validation rejecting duplicate identifiers, unknown statuses, and any category proposing a transition the lead transition map does not permit
- [ ] 1.3 Add `resolveResponseCategory` refusing an unknown identifier with a message listing the configured ones
- [ ] 1.4 Add the no-response interval and the minimum reporting sample size, both validated positive
- [ ] 1.5 Add unit tests covering every scenario in `specs/product-configuration/spec.md`
- [ ] 1.6 Verify: `pnpm --filter @mela/config lint typecheck test` passes

## 2. Schema

- [ ] 2.1 Add the `outreach_response_kind` enum and the `outreach_responses` table with its cascade delete and `(outreach_id, received_at DESC)` index
- [ ] 2.2 Add `sent_means` to `outreach` with the `CHECK` requiring it whenever a send time is present
- [ ] 2.3 Add the trigger refusing a response earlier than its message's send time
- [ ] 2.4 Add `do_not_contact_at` and `do_not_contact_reason` to `companies` and `contacts`, each with the non-blank reason `CHECK`
- [ ] 2.5 Add the trigger refusing an outreach insert for a marked contact or a marked company
- [ ] 2.6 Add write helpers: record a send, record a response, set and clear a do-not-contact marker
- [ ] 2.7 Generate and commit the migration; confirm `pnpm db:check` reports no drift
- [ ] 2.8 Add integration tests covering every scenario in `specs/lead-data-model/spec.md`, including raw writes that bypass the helpers
- [ ] 2.9 Verify: `pnpm --filter @mela/database lint typecheck test` passes with the Compose stack running

## 3. Recording a send

- [ ] 3.1 Add `POST /api/outreach/:id/sent` taking the send time and means, refusing a record that is not approved
- [ ] 3.2 Confirm the existing constraints refuse a send time earlier than the approval
- [ ] 3.3 Add a test asserting that recording a send contacts no external service and transmits nothing
- [ ] 3.4 Add API tests for the approved, unapproved and backdated cases
- [ ] 3.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 4. Reply classification

- [ ] 4.1 Add the classification prompt to `packages/ai` at version 1, with a discriminated-union output carrying either a category and the basis text or an unclassified outcome
- [ ] 4.2 Implement the grounding check requiring the basis text to occur in the supplied reply, discarding a classification that fails it
- [ ] 4.3 Add `POST /api/outreach/:id/responses/classify` returning the category, its basis and the proposed transition, writing nothing
- [ ] 4.4 Add unit tests against the fake provider: a grounded classification, an ungrounded one discarded, the unclassified branch
- [ ] 4.5 Add a test asserting the classify endpoint leaves the lead status unchanged
- [ ] 4.6 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 5. Confirmation and lifecycle

- [ ] 5.1 Add `POST /api/outreach/:id/responses` requiring a confirmed category, recording the response and applying its transition through `applyLeadStatusChange`
- [ ] 5.2 Confirm a person can select a different configured category from the one proposed
- [ ] 5.3 Confirm an impermissible transition is refused naming the current status, the requested status and the permitted targets, with the lead unchanged
- [ ] 5.4 Add the no-response recording path available after the configured interval
- [ ] 5.5 Add the workflow test: approve, record send, classify, confirm, assert the status moved
- [ ] 5.6 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 6. Do not contact

- [ ] 6.1 Set the marker automatically when a response is recorded as an unsubscribe request
- [ ] 6.2 Exclude marked companies and contacts from drafting, refusing before any model call
- [ ] 6.3 Exclude marked records from outreach candidate listings and future pipeline runs
- [ ] 6.4 Add explicit endpoints to set and clear the marker, each recording the reason and the time
- [ ] 6.5 Add a test asserting no drafting or outreach interface exposes an override parameter
- [ ] 6.6 Add integration tests covering every do-not-contact scenario in `specs/outreach-tracking/spec.md`
- [ ] 6.7 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 7. Evaluation aggregates

- [ ] 7.1 Implement aggregates by industry, service, opportunity category, priority band and score decile, computed from recorded outcomes only
- [ ] 7.2 Return the sent, responded and unrecorded counts with every rate, excluding unrecorded from numerator and denominator
- [ ] 7.3 Mark a rate below the configured minimum sample size and compute no trend or comparison for that segment
- [ ] 7.4 Add `GET /api/analytics/outreach` with segment selection
- [ ] 7.5 Add tests: a nine-message segment marked below minimum with counts returned, and unrecorded messages excluded correctly
- [ ] 7.6 Verify: `pnpm --filter @mela/api lint typecheck test build` passes

## 8. Documentation and final verification

- [ ] 8.1 Document the module in `docs/architecture.md`, including why classification proposes rather than applies and why do-not-contact has no override
- [ ] 8.2 Update `docs/outreach-review.md` with the send-recording and response workflow
- [ ] 8.3 Update `docs/data-model.md` and `docs/implementation-progress.md`
- [ ] 8.4 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 8.5 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 8.6 Run `openspec validate add-outreach-tracking --strict` and resolve anything it reports
