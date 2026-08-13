# Tasks — Add Outreach Drafting and Human Approval

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Channel and content configuration

- [x] 1.1 Add per-channel drafting constraints to `packages/config`: maximum subject length, maximum body length, whether a subject applies, and tone
- [x] 1.2 Add the prohibited-content categories and patterns: invented fact, promised outcome, false relationship, commercial terms, urgency pressure
- [x] 1.3 Add load-time validation for invalid patterns, and a test asserting no channel can be configured with automated sending permitted
- [x] 1.4 Add unit tests with positive and negative cases per prohibited category
- [x] 1.5 Verify: `pnpm --filter @mela/config lint typecheck test` passes

## 2. Schema

- [x] 2.1 Add the subject, generated subject and body, human-edited flag, prompt version, invocation reference and cited facts columns to `outreach`
- [x] 2.2 Add the rejection reason and time, the approval revocation time, the approved text hash and the generated current text hash columns
- [x] 2.3 Add the `CHECK` requiring an invocation for generated text, the `CHECK` requiring a non-blank rejection reason, and the `CHECK` requiring an approved record's hash to match its current text
- [x] 2.4 Update `insertOutreachDraft` for the new provenance fields, confirming it still has no status, approval or sent parameter
- [x] 2.5 Add `updateOutreachText` clearing the approval, returning the record to draft and recording the revocation when text changes on an approved record
- [x] 2.6 Add `rejectOutreach` requiring a reason
- [x] 2.7 Generate and commit the migration; confirm `pnpm db:check` reports no drift
- [x] 2.8 Add integration tests covering every scenario in `specs/lead-data-model/spec.md`, including a raw `UPDATE` changing an approved record's body
- [x] 2.9 Verify: `pnpm --filter @mela/database lint typecheck test` passes with the Compose stack running

## 3. The absence of a transport

- [x] 3.1 Add a test asserting the outreach module's dependency closure contains no mail, messaging or social client package
- [x] 3.2 Add a test asserting the API environment schema declares no sending credential
- [x] 3.3 Add a test asserting no controller in the module reports transmission and no scheduling mechanism exists
- [x] 3.4 Verify: all three fail if a transport dependency is added, by adding one temporarily and confirming the failure before removing it

## 4. The drafting prompt

- [x] 4.1 Add a drafting prompt per configured channel to `packages/ai` at version 1, returning a subject where applicable, a body, and the list of claims it makes with their citations
- [x] 4.2 Instruct the model to make no promise, state no price or timeline, and claim no prior contact
- [x] 4.3 Add unit tests: rendering keeps instructions and input separate, and summary text containing instruction-like content stays inside the input block
- [x] 4.4 Verify: `pnpm --filter @mela/ai lint typecheck test` passes

## 5. Drafting and grounding

- [x] 5.1 Build the model input from the lead's current research summary, its opportunities with citations, the selected contact and the service catalogue, minting call-local references
- [x] 5.2 Refuse drafting for a lead with no current summary, a contact with no detail for the channel, a detail with no source URL, or an unknown channel — each naming the reason and making no model call where the refusal precedes it
- [x] 5.3 Implement the post-parse citation check rejecting the whole draft when any claim is uncited or cites an unsupplied identifier
- [x] 5.4 Implement the prohibited-content screen over the whole body, rejecting the draft with the matched category
- [x] 5.5 Validate channel length constraints after generation, rejecting rather than truncating
- [x] 5.6 Persist accepted drafts with their provenance in the draft state
- [x] 5.7 Add unit tests against the fake provider for every rejection path and the no-partial-salvage rule
- [x] 5.8 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 6. Review workflow

- [ ] 6.1 Add `POST /api/leads/:id/outreach/draft` and `GET /api/outreach` filtered by status
- [ ] 6.2 Add `PATCH /api/outreach/:id` editing subject and body, revoking approval when the record was approved
- [ ] 6.3 Add `POST /api/outreach/:id/submit`, `POST /api/outreach/:id/approve` taking a single id in the path with a server-side timestamp, `POST /api/outreach/:id/reject` requiring a reason, and `POST /api/outreach/:id/cancel`
- [ ] 6.4 Confirm no endpoint accepts more than one message per approval call and no approve-all route exists
- [ ] 6.5 Add the workflow test: draft, submit, approve, edit, assert back in draft with no approval and a recorded revocation
- [ ] 6.6 Add API tests covering every remaining scenario in `specs/outreach-drafting/spec.md`
- [ ] 6.7 Verify: `pnpm --filter @mela/api lint typecheck test build` passes

## 7. Documentation and final verification

- [x] 7.1 Document the module in `docs/architecture.md`, stating that no send exists and that an edit revokes approval, with the database constraints that enforce both
- [x] 7.2 Add `docs/outreach-review.md`: the workflow, what approval means, and why there is no bulk approval
- [x] 7.3 Update `docs/data-model.md` and `docs/implementation-progress.md`
- [x] 7.4 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [x] 7.5 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [x] 7.6 Run `openspec validate add-outreach-drafting --strict` and resolve anything it reports
