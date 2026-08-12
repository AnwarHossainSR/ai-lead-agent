# Tasks — Add Technology Detection

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Fingerprint configuration

- [x] 1.1 Add technology category configuration to `packages/config` with unique-identifier validation
- [x] 1.2 Add the fingerprint type and schema: identifier, technology, category, patterns with their match location and optional version capture group, and implications
- [x] 1.3 Add load-time validation for duplicate identifiers, empty pattern lists, invalid expressions and unknown categories
- [x] 1.4 Add the catastrophic-backtracking screen rejecting nested unbounded repetition, naming the offending fingerprint
- [x] 1.5 Add implication cycle detection over the fingerprint graph, naming the fingerprints in the cycle
- [x] 1.6 Add `resolveFingerprint` refusing an unknown identifier with a message listing the configured ones
- [x] 1.7 Add the initial fingerprint set covering CMSes, e-commerce platforms, front-end frameworks, page builders, analytics, CDNs, payment providers and hosting
- [x] 1.8 Add unit tests covering every scenario in `specs/product-configuration/spec.md`
- [x] 1.9 Verify: `pnpm --filter @mela/config lint typecheck test` passes

## 2. Schema

- [x] 2.1 Add the `technology_detections` table with its columns, the per-analysis uniqueness constraint, and both `CHECK` constraints for observed and inferred
- [x] 2.2 Add the `technology_id` and `(company_id, created_at DESC)` indexes
- [x] 2.3 Add write helpers deriving `company_id` from the analysis rather than accepting it, and refusing a caller-supplied value
- [x] 2.4 Add the upgrade path replacing an inferred detection with an observed one, and refusing the reverse
- [x] 2.5 Add a read helper returning the detections of a company's most recent completed analysis, and a portfolio count by technology
- [x] 2.6 Generate and commit the migration; confirm `pnpm db:check` reports no drift
- [x] 2.7 Add integration tests covering every scenario in `specs/lead-data-model/spec.md`, including raw `INSERT`s that bypass the helpers
- [x] 2.8 Verify: `pnpm --filter @mela/database lint typecheck test` passes with the Compose stack running

## 3. The matcher

- [x] 3.1 Derive the six match locations from a stored `PageCapture`: headers, HTML, script URLs, stylesheet URLs, cookie names and meta generator
- [x] 3.2 Implement pattern evaluation producing a detection carrying the fingerprint, the location and the matched text
- [x] 3.3 Implement version extraction from a declared capture group only, recording no version when none matched
- [x] 3.4 Enforce the HTML byte bound and the total matching time budget, retaining partial results with a recorded reason
- [x] 3.5 Evaluate fingerprints in a stable declared order so a partial result is deterministic
- [x] 3.6 Add unit tests per match location, plus version present and absent, against `PageCapture` fixtures
- [x] 3.7 Add a determinism test asserting two runs over one fixture produce identical output
- [x] 3.8 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 4. Implications

- [x] 4.1 Resolve implications transitively from observed detections, recording each implied technology as inferred with the implying detection referenced
- [x] 4.2 Implement the upgrade rule: a directly matched technology already recorded as inferred becomes observed with its own evidence
- [x] 4.3 Confirm an implication never downgrades an existing observation
- [x] 4.4 Add unit tests for chains, upgrades and the no-downgrade rule
- [x] 4.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 5. Integration with analysis

- [x] 5.1 Call detection from the analysis service after a completed capture, writing detections in the same transaction as the analysis
- [x] 5.2 Write the denormalized `website_analysis.technologies` summary from the same detections
- [x] 5.3 Return no detections with a stated reason when an analysis has no usable capture
- [x] 5.4 Add `POST /api/analysis/:id/detect` re-running the matcher against a stored capture, and confirm it makes no network request
- [x] 5.5 Add `GET /api/companies/:id/technologies` returning the latest completed analysis's detections
- [x] 5.6 Add a test asserting no code path in the module issues a network request or calls a language model
- [x] 5.7 Add API and integration tests covering every remaining scenario in `specs/technology-detection/spec.md`
- [x] 5.8 Verify: `pnpm --filter @mela/api lint typecheck test build` passes

## 6. Documentation and final verification

- [ ] 6.1 Document detection in `docs/architecture.md`, including why fingerprints are curated rather than imported and why versions are never inferred
- [ ] 6.2 Add `docs/technology-fingerprints.md`: how to add a fingerprint, what each match location sees, and how to re-run detection over existing captures
- [ ] 6.3 Update `docs/data-model.md` and `docs/implementation-progress.md`
- [ ] 6.4 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 6.5 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 6.6 Run `openspec validate add-technology-detection --strict` and resolve anything it reports
