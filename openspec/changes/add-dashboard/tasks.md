# Tasks — Add Dashboard

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Evidence primitives

- [x] 1.1 Build `<Fact>` rendering observed, inferred and unknown as three distinct states, with no path producing a blank, a dash or a zero for a missing value
- [x] 1.2 Build `<Evidence>` showing the source URL as a link, the time recorded, and the matched or cited text in a popover
- [x] 1.3 Build `<Generated>` labelling model-produced prose persistently
- [x] 1.4 Add component tests for all three, including an unmeasured score not rendering as zero
- [x] 1.5 Verify: `pnpm --filter @mela/web lint typecheck test` passes

## 2. Read endpoints

- [x] 2.1 Add the list endpoints the views need: leads with filters and ordering, companies with pipeline state, outreach by status
- [x] 2.2 Include the certainty, source URL and recorded time on every claim the views render
- [ ] 2.3 Include failure and incomplete states in list responses rather than omitting those records
- [ ] 2.4 Add API tests for the filters, ordering and the presence of provenance fields
- [ ] 2.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 3. Application shell and navigation

- [ ] 3.1 Expand the shell into the workspace layout with navigation to leads, companies, outreach review, analytics and operations
- [ ] 3.2 Move filters into URL search params so a filtered view is a shareable link
- [ ] 3.3 Add per-panel Suspense and error boundaries using the existing bounded-timeout fetch helper
- [ ] 3.4 Add tests: the API stopped renders the condition, a single failing endpoint degrades only its panel
- [ ] 3.5 Verify: `pnpm --filter @mela/web lint typecheck test build` passes

## 4. Lead views

- [ ] 4.1 Build the lead list ordered by score with filters for priority, status, industry, city, service and staleness
- [ ] 4.2 Build the lead detail view: score with component breakdown and explanation, opportunities with cited evidence, detections with matched text, contacts with sources
- [ ] 4.3 Render the research summary through `<Generated>` with its unknown list
- [ ] 4.4 Add tests: an inferred value carries its marker, an unknown field renders the word, every source URL is a link
- [ ] 4.5 Verify: `pnpm --filter @mela/web lint typecheck test` passes

## 5. Outreach review queue

- [ ] 5.1 Build the review view showing one message at a time beside the facts it cites, each with its source and certainty
- [ ] 5.2 Disable approval until the message body has been rendered in the viewport
- [ ] 5.3 Add approve, edit, reject-with-required-reason and cancel actions as Server Actions
- [ ] 5.4 Show that an edit to an approved message revoked its approval and returned it to the queue
- [ ] 5.5 Confirm the view offers no bulk approval, no multi-select and no send control
- [ ] 5.6 Add the Playwright workflow test: open, read, approve, edit, assert back in the queue; and a rejection requiring a reason
- [ ] 5.7 Add a Playwright test asserting no bulk-approval or send control exists anywhere in the outreach views
- [ ] 5.8 Verify: `pnpm --filter @mela/web lint typecheck test build` passes

## 6. Company and pipeline views

- [ ] 6.1 Build the company list with verification state, analysis outcome and pipeline stage, including failed and blocked records
- [ ] 6.2 Build the company detail view with its analyses, detections and contacts
- [ ] 6.3 Add the needs-attention view collecting blocked, failed and unreachable records with counts and ages
- [ ] 6.4 Add tests: a blocked analysis shows as blocked, unreachable is distinguishable from unverified, a below-threshold company states the reason
- [ ] 6.5 Verify: `pnpm --filter @mela/web lint typecheck test` passes

## 7. Analytics

- [ ] 7.1 Build the shared Recharts wrapper taking rate, sent, responded, unrecorded and the below-minimum flag, always rendering counts
- [ ] 7.2 Suppress trend lines and comparisons for segments below the reporting minimum
- [ ] 7.3 Build the response-rate views by industry, service, opportunity category, priority band and score decile
- [ ] 7.4 Add tests: counts always displayed, a small sample marked, no trend drawn below the minimum
- [ ] 7.5 Verify: `pnpm --filter @mela/web lint typecheck test` passes

## 8. Operations

- [ ] 8.1 Build the operations view showing queue depths, failed jobs with reasons and an explicit retry action
- [ ] 8.2 Show discovery runs with their per-source counts and outcomes
- [ ] 8.3 Add tests covering the retry action and the degraded state when Redis is unreachable
- [ ] 8.4 Verify: `pnpm --filter @mela/web lint typecheck test build` passes

## 9. Accessibility and final verification

- [ ] 9.1 Add automated accessibility checks against the lead list, lead detail and review queue, failing on a violation at the configured level
- [ ] 9.2 Confirm the review queue is fully operable by keyboard and every interactive control has an accessible name
- [ ] 9.3 Add the accessibility checks to the CI workflow
- [ ] 9.4 Document the views in `docs/architecture.md` and state the local-only, unauthenticated posture in `README.md` and `docs/development.md`
- [ ] 9.5 Update `docs/implementation-progress.md`
- [ ] 9.6 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 9.7 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 9.8 Run `openspec validate add-dashboard --strict` and resolve anything it reports
