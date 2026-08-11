# Tasks — Add Website Analysis

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Configuration and environment

- [ ] 1.1 Add analysis configuration to `packages/config`: the two viewports, the extra paths to try, the observation rule thresholds, and the staleness window, as frozen validated data
- [ ] 1.2 Add `ANALYSIS_ARTIFACT_ROOT`, `ANALYSIS_NAVIGATION_TIMEOUT_MS`, `ANALYSIS_RUN_TIMEOUT_MS` and `ANALYSIS_MAX_PAGE_BYTES` to the API env schema with a `.describe()` on each, and to `.env.example`
- [ ] 1.3 Add a startup check creating the artifact root if absent and aborting with a message naming the variable and path when it is not writable
- [ ] 1.4 Add the artifact root to `.gitignore` and assert in a test that no artifact is tracked
- [ ] 1.5 Add a test asserting the analysis configuration schema contains no proxy, user-agent-rotation or challenge-solving field
- [ ] 1.6 Verify: `pnpm --filter @mela/config lint typecheck test` passes and a missing variable aborts startup naming it

## 2. Schema for outcomes and artifacts

- [ ] 2.1 Add the `website_analysis_outcome` enum and the outcome, failure reason, analysed URL, HTTP status, artifact path and unverified-override columns to `website_analysis`
- [ ] 2.2 Add the `CHECK` requiring a reason for a non-completed outcome, and the `CHECK` refusing any score on a blocked, skipped or failed analysis
- [ ] 2.3 Add the partial unique index permitting one in-progress analysis per company
- [ ] 2.4 Add the index supporting the staleness query, including companies never analysed
- [ ] 2.5 Add write helpers: start an analysis, record capture artifacts, complete with scores and observations, and fail with a reason — with artifact paths rejected when absolute or escaping the root
- [ ] 2.6 Generate and commit the migration; confirm `pnpm db:check` reports no drift
- [ ] 2.7 Add integration tests covering every scenario in `specs/lead-data-model/spec.md`, including raw `UPDATE`s that bypass the helpers
- [ ] 2.8 Verify: `pnpm --filter @mela/database lint typecheck test` passes with the Compose stack running

## 3. The fixture site

- [ ] 3.1 Add a local fixture server serving a good site, a plain-HTTP site, a site with console errors, a never-loading site, a 403 challenge site, an oversized response and a restrictive `robots.txt`
- [ ] 3.2 Wire it into the API test setup so no test depends on an external host
- [ ] 3.3 Verify: the fixture server starts and stops cleanly within a Vitest run

## 4. Browser and capture

- [ ] 4.1 Add `playwright` as a runtime dependency of `apps/api` with a pinned version, and the browser install step to setup docs and CI
- [ ] 4.2 Implement the lazily-launched shared browser with a per-analysis context, disposed in a `finally`, and closed in `onApplicationShutdown`
- [ ] 4.3 Set the fixed, honest user agent in one place and add a test asserting it never varies
- [ ] 4.4 Implement page capture at both viewports producing the serialisable `PageCapture` record: final URL, status, redirect chain, timings, transfer size, console messages, failed requests, response headers and rendered HTML
- [ ] 4.5 Enforce the navigation timeout and the maximum page weight, each ending the analysis with a reason naming the limit
- [ ] 4.6 Add integration tests: a never-loading site is abandoned within the timeout, an oversized page is abandoned, no browser process survives a crash
- [ ] 4.7 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 5. Artifacts

- [ ] 5.1 Implement artifact path building keyed by company and analysis id, asserting containment within the configured root before any write
- [ ] 5.2 Write desktop and mobile screenshots, the rendered HTML and the raw audit report; store only relative paths
- [ ] 5.3 Add unit tests: an escaping path is refused, a failed capture stores no path
- [ ] 5.4 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 6. Quality audit

- [ ] 6.1 Add `lighthouse` with a pinned version and attach it to the Playwright browser over CDP rather than letting it launch its own
- [ ] 6.2 Map audit categories to the four score columns, leaving a category unrecorded when the audit returns no value for it
- [ ] 6.3 Record an audit failure as a partial outcome retaining the capture, with no scores
- [ ] 6.4 Add integration tests: a completed audit stores scores, a failed audit stores none, a missing category is not filled in, zero is distinguishable from unmeasured
- [ ] 6.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 7. Observation rules

- [ ] 7.1 Define the `ObservationRule` type as a pure function from `PageCapture` to observations carrying description, URL, observation time and a certainty of observed
- [ ] 7.2 Implement the initial rules: no HTTPS, invalid certificate, missing viewport meta, render-blocking resources, console errors, failed requests, missing title or meta description, missing favicon, mixed content, excessive page weight
- [ ] 7.3 Add unit tests per rule against `PageCapture` fixtures, with no browser involved
- [ ] 7.4 Add a test asserting no rule emits a finding about a page that failed to load, and none emits a certainty other than observed
- [ ] 7.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 8. Politeness

- [ ] 8.1 Reuse the shared `robots.txt` evaluator and per-host limiter for every request the analysis makes, including the extra paths
- [ ] 8.2 Record a disallowed path as a skipped analysis with that reason, making no request
- [ ] 8.3 Record a blocking or challenging host as a blocked analysis with no scores, with no retry and no disguise
- [ ] 8.4 Add integration tests against the fixture site for the disallowed and blocking cases
- [ ] 8.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 9. Orchestration and API

- [ ] 9.1 Implement the analysis service: refuse a company with no website, refuse an unverified company without an explicit override, record the override when given
- [ ] 9.2 Enforce the total run timeout across capture and audit, retaining partial capture, and surface the in-progress uniqueness violation as a named refusal
- [ ] 9.3 Add `POST /api/companies/:id/analysis`, `GET /api/companies/:id/analysis/latest` and `GET /api/companies/:id/analysis`
- [ ] 9.4 Add API tests covering every remaining scenario in `specs/website-analysis-pipeline/spec.md`
- [ ] 9.5 Verify: `pnpm --filter @mela/api lint typecheck test build` passes

## 10. CI, documentation and final verification

- [ ] 10.1 Add the pinned browser installation step to the CI workflow, cached by version, and confirm the API test job passes with it
- [ ] 10.2 Document the module in `docs/architecture.md`, including why a blocked site is recorded rather than evaded
- [ ] 10.3 Document the browser install command and the artifact directory in `docs/development.md`
- [ ] 10.4 Update `docs/data-model.md` and `docs/implementation-progress.md`
- [ ] 10.5 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 10.6 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 10.7 Run `openspec validate add-website-analysis --strict` and resolve anything it reports
