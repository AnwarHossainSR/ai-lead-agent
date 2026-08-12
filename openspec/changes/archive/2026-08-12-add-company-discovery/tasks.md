# Tasks — Add Company Discovery

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Discovery source configuration

- [x] 1.1 Add discovery source configuration to `packages/config`: identifier, display name, kind, enabled, covered countries, maximum request rate, crawl permission — with `as const` exports and frozen values
- [x] 1.2 Add load-time validation: duplicate identifiers, coverage of unconfigured countries, and non-positive request rates all fail at load
- [x] 1.3 Add `resolveDiscoverySource` refusing an unknown identifier with a message listing the configured ones, and export the derived `DiscoverySourceId` union
- [x] 1.4 Add the three initial source declarations (`file-import`, `places`, one directory) with crawl permission defaulting to denied
- [x] 1.5 Add unit tests covering every scenario in `specs/product-configuration/spec.md`, including the assertion that the schema has no robots-override field
- [x] 1.6 Verify: `pnpm --filter @mela/config lint typecheck test` passes

## 2. Schema for runs and provenance

- [x] 2.1 Add the `discovery_run_outcome` and `discovery_source_outcome` enums and the `discovery_runs` table with its `CHECK` constraints
- [x] 2.2 Add `discovery_run_sources` with the unique `(run_id, source_id)`, non-negative count constraints and cascade delete
- [x] 2.3 Add `company_discovery_sources` with its composite primary key and cascade delete
- [x] 2.4 Add the nullable `discovery_run_id` on `companies` with `ON DELETE SET NULL`, and the partial unique index preventing two runs in progress for one country and industry
- [x] 2.5 Add validated write helpers: start a run, record a per-source result, finish a run, and record a company source
- [x] 2.6 Generate and commit the migration; confirm `pnpm db:check` reports no drift
- [x] 2.7 Add integration tests covering every scenario in `specs/lead-data-model/spec.md`
- [x] 2.8 Verify: `pnpm --filter @mela/database lint typecheck test` passes with the Compose stack running

## 3. Source adapter interface and the file-import adapter

- [x] 3.1 Define the `DiscoverySource` interface and the `DiscoveredCandidate` type with a required `sourceUrl` and every unverifiable attribute optional
- [x] 3.2 Add the Zod schema validating a candidate at the adapter boundary, rejecting a missing or blank source URL with a named reason
- [x] 3.3 Implement the `file-import` adapter reading a CSV or JSON list, validating each row, and reporting rejections by reason
- [x] 3.4 Add a fake source in `src/discovery/testing/` capable of returning candidates, an empty result, a block, and a failure
- [x] 3.5 Add unit tests: a candidate without a source URL is rejected, omitted attributes stay absent, no URL is constructed
- [x] 3.6 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 4. Politeness: robots and rate limiting

- [x] 4.1 Implement `robots.txt` fetching, per-origin caching with a 24-hour TTL, and path evaluation, treating a malformed or unreachable file as disallowing
- [x] 4.2 Implement the per-source token bucket taking the slower of the configured interval and the declared crawl-delay
- [x] 4.3 Implement block detection — 403, 429 without `retry-after`, and bot-challenge response signatures — ending the source for the run
- [x] 4.4 Add a test asserting the module exposes no proxy, user-agent-rotation or challenge-solving option
- [x] 4.5 Add unit tests covering disallowed paths, crawl-delay spacing, and abandonment on block
- [x] 4.6 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 5. Deduplication

- [x] 5.1 Implement the deterministic dedup service: normalized domain first, then normalized name within the same country, then new
- [x] 5.2 Wire it to update provenance on a match rather than creating a second company
- [x] 5.3 Add unit and integration tests: two sources yielding one company, rediscovery counted as duplicate, two website-less companies with different names both stored, same name merged
- [x] 5.4 Add a test asserting no code path in the dedup service calls a language model
- [x] 5.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 6. Run orchestration

- [x] 6.1 Implement the run service: resolve and validate the requested territory and industry, select enabled sources covering that country, refuse unknown identifiers naming the configured ones
- [x] 6.2 Iterate sources through the rate limiter, collecting candidates and recording per-source counts and outcomes
- [x] 6.3 Enforce the candidate and duration limits, ending the run with an outcome naming the limit and retaining what was stored
- [x] 6.4 Record run completion, including the partial outcome when one source fails and another succeeds
- [x] 6.5 Add integration tests covering every scenario in `specs/company-discovery/spec.md` using the fake source and a `file-import` fixture
- [x] 6.6 Verify: `pnpm --filter @mela/api lint typecheck test` passes with the Compose stack running

## 7. The places adapter

- [x] 7.1 Add the licensed places API key and base URL to the API env schema and `.env.example`, with the key treated as a secret
- [x] 7.2 Implement the `places` adapter mapping API results to candidates, carrying the API's own record URL as the source URL
- [x] 7.3 Add recorded response fixtures and tests against them; confirm no test makes a live request
- [x] 7.4 Verify: the adapter is disabled by default in configuration and a run without the key refuses that source by name rather than failing the run

## 8. API surface

- [x] 8.1 Add `POST /api/discovery/runs` with a Zod DTO validating the territory and industry, returning the completed run record
- [x] 8.2 Add `GET /api/discovery/runs` and `GET /api/discovery/runs/:id` returning per-source counts and outcomes
- [x] 8.3 Confirm the in-progress uniqueness index surfaces as a clear refusal rather than a database error
- [x] 8.4 Add API tests: an unknown industry returns 400 naming the configured ones, a completed run returns its counts, no credential appears in any response
- [x] 8.5 Verify: `pnpm --filter @mela/api lint typecheck test build` passes

## 9. Documentation and final verification

- [ ] 9.1 Document the discovery module in `docs/architecture.md`, including why LinkedIn and search-engine scraping are not sources
- [ ] 9.2 Add `docs/discovery-sources.md`: how to add a source, what crawl permission means, and what happens on a block
- [ ] 9.3 Update `docs/data-model.md` and `docs/implementation-progress.md`
- [ ] 9.4 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 9.5 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 9.6 Run `openspec validate add-company-discovery --strict` and resolve anything it reports
