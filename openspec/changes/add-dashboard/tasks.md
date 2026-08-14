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
- [x] 2.3 Include failure and incomplete states in list responses rather than omitting those records
- [x] 2.4 Add API tests for the filters, ordering and the presence of provenance fields
- [x] 2.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 3. Application shell and navigation

- [x] 3.1 Expand the shell into the workspace layout with navigation to leads, companies, outreach review, analytics and operations
- [x] 3.2 Move filters into URL search params so a filtered view is a shareable link
- [x] 3.3 Add per-panel Suspense and error boundaries using the existing bounded-timeout fetch helper
- [x] 3.4 Add tests: the API stopped renders the condition, a single failing endpoint degrades only its panel
- [x] 3.5 Verify: `pnpm --filter @mela/web lint typecheck test build` passes

## 4. Lead views

- [x] 4.1 Build the lead list ordered by score with filters for priority, status, industry, city, service and staleness
- [x] 4.2 Build the lead detail view: score with component breakdown and explanation, opportunities with cited evidence, detections with matched text, contacts with sources
- [x] 4.3 Render the research summary through `<Generated>` with its unknown list
- [x] 4.4 Add tests: an inferred value carries its marker, an unknown field renders the word, every source URL is a link
- [x] 4.5 Verify: `pnpm --filter @mela/web lint typecheck test` passes

## 5. Outreach review queue

- [x] 5.1 Build the review view showing one message at a time beside the facts it cites, each with its source and certainty
- [x] 5.2 Disable approval until the message body has been rendered in the viewport
- [x] 5.3 Add approve, edit, reject-with-required-reason and cancel actions as Server Actions
- [x] 5.4 Show that an edit to an approved message revoked its approval and returned it to the queue
- [x] 5.5 Confirm the view offers no bulk approval, no multi-select and no send control
- [ ] 5.6 Add the Playwright workflow test: open, read, approve, edit, assert back in the queue; and a rejection requiring a reason — **deferred**: skipped per user instruction (no new Playwright tests this session). Covered instead by vitest component tests on `MessageReviewCard` (viewport-gated approve, required rejection reason, revoke-on-edit notice).
- [ ] 5.7 Add a Playwright test asserting no bulk-approval or send control exists anywhere in the outreach views — **deferred**: skipped per user instruction. Covered instead by a vitest assertion that no bulk-approve, multi-select or send control renders.
- [x] 5.8 Verify: `pnpm --filter @mela/web lint typecheck test` passes (Playwright portion of the `test` script intentionally not exercised for this section's new surface, per the same instruction) plus `build`

## 6. Company and pipeline views

- [x] 6.1 Build the company list with verification state, analysis outcome and pipeline stage, including failed and blocked records
- [x] 6.2 Build the company detail view with its analyses, detections and contacts
- [x] 6.3 Add the needs-attention view collecting blocked, failed and unreachable records with counts and ages
- [x] 6.4 Add tests: a blocked analysis shows as blocked, unreachable is distinguishable from unverified, a below-threshold company states the reason
- [x] 6.5 Verify: `pnpm --filter @mela/web lint typecheck test` passes

## 7. Analytics

- [x] 7.1 Build the shared Recharts wrapper taking rate, sent, responded, unrecorded and the below-minimum flag, always rendering counts
- [x] 7.2 Suppress trend lines and comparisons for segments below the reporting minimum
- [x] 7.3 Build the response-rate views by industry, service, opportunity category, priority band and score decile
- [x] 7.4 Add tests: counts always displayed, a small sample marked, no trend drawn below the minimum
- [x] 7.5 Verify: `pnpm --filter @mela/web lint typecheck test` passes

## 8. Operations

- [x] 8.1 Build the operations view showing queue depths, failed jobs with reasons and an explicit retry action — **adapted**: jobs run through Upstash QStash (HTTP push), not a Redis-backed local queue, so there is no pollable "pending depth"; the view shows each queue's configuration alongside its real dead-letter (failed) count, sourced from QStash's DLQ API, per user decision
- [x] 8.2 Show discovery runs with their per-source counts and outcomes
- [x] 8.3 Add tests covering the retry action and the degraded state when Redis is unreachable — **adapted**: the queue/failed-jobs panel's actual dependency is QStash, not Redis (Redis is unused beyond the health check); its API test covers the retry action and the panel degrading when QStash is unreachable, and the frontend's existing per-panel Suspense/error boundary (proven in task 3.4) covers independent panel degradation generically
- [x] 8.4 Verify: `pnpm --filter @mela/web lint typecheck test build` passes

## 9. Accessibility and final verification

- [x] 9.1 Add automated accessibility checks against the lead list, lead detail and review queue, failing on a violation at the configured level — **adapted**: component-level checks via vitest-axe (WCAG 2.1 A/AA) against the presentational pieces of each view, per user decision, rather than full-page checks (which would need Playwright, excluded this session)
- [x] 9.2 Confirm the review queue is fully operable by keyboard and every interactive control has an accessible name
- [x] 9.3 Add the accessibility checks to the CI workflow — the CI `test` job now runs `pnpm --filter @mela/web exec vitest run`, which includes the a11y suite; Playwright is excluded (needs a running API/DB and browser binaries this job doesn't provision)
- [x] 9.4 Document the views in `docs/architecture.md` and state the local-only, unauthenticated posture in `README.md` and `docs/development.md`
- [x] 9.5 Update `docs/implementation-progress.md`
- [x] 9.6 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output — lint/typecheck/build all pass; test passes per-package in isolation (found and fixed a real turbo.json gap: `API_URL`/`NEXT_PUBLIC_API_URL` weren't declared as build-task env, so a root `pnpm build` silently produced static pages instead of dynamic ones — fixed; also fixed a stale `QSTASH_TOKEN`-less fixture in `packages/config`'s env test). One pre-existing, unrelated failure remains in `packages/database` (see implementation-progress.md) plus a pre-existing lack of DB isolation between `@mela/api` and `@mela/database` when run concurrently at the root — both predate and are outside `add-dashboard`'s scope
- [ ] 9.7 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 9.8 Run `openspec validate add-dashboard --strict` and resolve anything it reports
