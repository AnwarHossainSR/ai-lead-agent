# Tasks — Add Company Verification

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Verification rule configuration

- [ ] 1.1 Add the verification rule to `packages/config`: per-check required, sufficient and timeout settings, plus the staleness window, as frozen validated data
- [ ] 1.2 Add load-time validation rejecting an unknown check identifier, a rule with no required check, and a non-positive timeout or window
- [ ] 1.3 Add per-host politeness configuration (minimum request interval, maximum requests per company, batch concurrency) and assert the schema carries no politeness override
- [ ] 1.4 Add unit tests covering every scenario in `specs/product-configuration/spec.md`
- [ ] 1.5 Verify: `pnpm --filter @mela/config lint typecheck test` passes

## 2. Schema and write path

- [ ] 2.1 Add the `verification_verdict` and `company_verification_state` enums and the `verification_checks` table with the evidence-required `CHECK` constraint and the `(company_id, ran_at DESC)` index
- [ ] 2.2 Add `verification_state`, `verified_at` and `verification_run_id` to `companies`, with the constraint requiring a derivation time and the partial index supporting the stale query
- [ ] 2.3 Make `companies.verified` a generated summary of the state, so existing reads keep working
- [ ] 2.4 Remove the `verified` parameter from `insertCompany`, refuse it in `updateCompany`, and update the seed script and existing tests
- [ ] 2.5 Add `applyVerificationResult` as the only writer of the verification columns, and `listStaleCompanies`
- [ ] 2.6 Generate and commit the migration; confirm `pnpm db:check` reports no drift
- [ ] 2.7 Add integration tests covering every scenario in `specs/lead-data-model/spec.md`, including raw-`INSERT` attempts that bypass the helpers
- [ ] 2.8 Verify: `pnpm --filter @mela/database lint typecheck test` passes with the Compose stack running

## 3. Shared HTTP politeness

- [ ] 3.1 Extract the `robots.txt` evaluator and per-host rate limiter from the discovery module into `apps/api/src/http/`, leaving discovery's behaviour unchanged
- [ ] 3.2 Add block detection returning a `blocked` failure code, with no retry-with-different-headers path
- [ ] 3.3 Add a local HTTP fixture server for tests providing slow, blocking, redirecting and erroring hosts
- [ ] 3.4 Verify: discovery's existing tests still pass unchanged and `pnpm --filter @mela/api lint typecheck test` passes

## 4. The check interface and the deterministic checks

- [ ] 4.1 Define the `VerificationCheck` interface and the `CheckResult` type, with the guard that downgrades an evidence-free passed or failed verdict to unknown with a reason
- [ ] 4.2 Implement the `dns` check over an injected resolver, returning unknown on failure to resolve the resolver itself
- [ ] 4.3 Implement the `http` check with its timeout, redirect following, final-URL evidence, and unknown on block or timeout
- [ ] 4.4 Implement the `domain-name-match` check as a deterministic token comparison over the already-normalized values, with no request and no model
- [ ] 4.5 Add unit tests: a hanging host yields unknown within the timeout, a blocked host yields unknown recording the block, no check returns a verdict without evidence
- [ ] 4.6 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 5. The registry check

- [ ] 5.1 Add per-country registry configuration, absent where no usable public registry exists
- [ ] 5.2 Implement the `registry` check returning unknown where no registry is configured for the company's country
- [ ] 5.3 Add recorded fixtures and tests against them; confirm no test contacts a live registry
- [ ] 5.4 Verify: the rule's load-time validation refuses making `registry` required while any configured country lacks a registry

## 6. Verdict derivation

- [ ] 6.1 Implement `deriveState(results, rule)` as a pure, total, exported function
- [ ] 6.2 Add unit tests over every combination the rule admits, including all-unknown yielding unreachable and a required failure yielding unverified with the failing check named
- [ ] 6.3 Add a test asserting a stored company's verdict equals the value recomputed from its stored check records
- [ ] 6.4 Add a test asserting no code path in the derivation calls a language model
- [ ] 6.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 7. Verification service and API

- [ ] 7.1 Implement single-company verification: run the checks, persist each result, derive the state, write it with its derivation time
- [ ] 7.2 Implement batch verification with bounded concurrency, continuing past an individual failure and reporting verified, unverified, unreachable and errored counts
- [ ] 7.3 Add `POST /api/companies/:id/verify`, `POST /api/verification/batch` and `GET /api/companies/:id/verification`
- [ ] 7.4 Add API tests covering every scenario in `specs/company-verification/spec.md` against the fixture server
- [ ] 7.5 Verify: `pnpm --filter @mela/api lint typecheck test build` passes

## 8. Documentation and final verification

- [ ] 8.1 Document verification in `docs/architecture.md`, including why unreachable is distinct from unverified
- [ ] 8.2 Update `docs/data-model.md` with the new tables and the derived `verified` column
- [ ] 8.3 Update `docs/implementation-progress.md`
- [ ] 8.4 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 8.5 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 8.6 Run `openspec validate add-company-verification --strict` and resolve anything it reports
