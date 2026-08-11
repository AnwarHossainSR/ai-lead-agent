# Tasks — Bootstrap Project Foundation

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next one. Each task is one conventional commit.

Groups 1–3 cover Phase 1 (Project Foundation) tooling. Group 4 covers Phase 0 (Product Definition). Groups 5–6 cover Phase 2 (Database). Groups 7–8 complete Phase 1's application shells. Groups 9–10 close out CI, docs and end-to-end verification.

## 1. Repository and workspace scaffold

- [x] 1.1 Add root `package.json` (private, `packageManager` pinned to pnpm, `engines.node >= 22`), `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`, and `.gitignore` covering `node_modules`, build output, `.env.local`, `.turbo`, Playwright artifacts and coverage
- [x] 1.2 Add `.gitattributes` normalising line endings (`* text=auto eol=lf`) and marking `pnpm-lock.yaml` and `packages/database/drizzle/*.sql` as generated
- [x] 1.3 Add `turbo.json` with `build`, `lint`, `typecheck`, `test`, `dev` tasks, correct `dependsOn` ordering and output declarations; add matching root scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `format`)
- [x] 1.4 Add `packages/tsconfig` with `base.json`, `node.json` (for packages and the API) and `next.json` (for the web app), all `strict` with `noUncheckedIndexedAccess`
- [x] 1.5 Add `packages/eslint-config` as a shared flat config with the TypeScript rules plus the `no-restricted-properties` rule banning direct `process.env` access outside `packages/config`
- [x] 1.6 Add Prettier config and `.prettierignore` at the root, wired into the `format` script and enforced by ESLint
- [x] 1.7 Verify: `pnpm install` succeeds from a clean clone and `pnpm lint`, `pnpm typecheck`, `pnpm build` all pass on the empty workspace

## 2. Local infrastructure

- [x] 2.1 Add `docker-compose.yml` with PostgreSQL 17-alpine and Redis 7-alpine, pinned versions, named volumes (`pgdata`, `redisdata`) and host ports read from `POSTGRES_PORT` / `REDIS_PORT`
- [x] 2.2 Add `healthcheck` blocks to both services (`pg_isready`, `redis-cli ping`) with sensible interval, timeout and retries
- [x] 2.3 Verify: `docker compose up -d` brings both services to healthy, data survives `docker compose restart`, and changing `POSTGRES_PORT` in the environment file moves the published port

## 3. Environment configuration

- [x] 3.1 Create `packages/config` package skeleton (package.json, tsconfig, build/lint/typecheck/test scripts, exports map) with Zod as its only runtime dependency
- [x] 3.2 Add `src/env/` with `databaseEnvSchema`, `apiEnvSchema` and `webEnvSchema`, each parsing `process.env` once and exporting a frozen result, failing with a message that names the variable and its purpose
- [x] 3.3 Add committed `.env.example` with a placeholder and an explanatory comment for every variable, and confirm the real-value files (`.env`, `apps/web/.env.local`) are git-ignored
- [x] 3.4 Add a unit test asserting every key in every env schema is present in `.env.example`, and a test asserting a missing or malformed variable aborts with a named error
- [x] 3.5 Verify: `pnpm --filter @mela/config test` passes; deleting a required variable from a local env file produces the expected startup error

## 4. Product configuration (Phase 0)

- [x] 4.1 Add countries and cities configuration with Zod schemas, `as const` exports, frozen values, and validation that every city references a defined country
- [x] 4.2 Add industries configuration with unique-identifier validation and the five initial industries
- [x] 4.3 Add offered services configuration (identifier, display name, description) and a `resolveService` helper that throws on an unknown identifier rather than returning a default
- [x] 4.4 Add lead lifecycle configuration: the fourteen statuses, the permitted transition map, an `initialStatus`, and load-time validation that every transition target is a defined status and that terminal statuses have none
- [x] 4.5 Add `canTransition(from, to)` and `permittedTransitions(from)` helpers whose refusals name the source, the target and the permitted targets
- [x] 4.6 Add lead priority band configuration plus `classifyPriority(score)`, with load-time validation that the bands cover 0–100 with no gap or overlap, and range refusal for scores outside 0–100
- [x] 4.7 Add lead scoring weight configuration (five components totalling 100) with load-time validation of the total
- [x] 4.8 Add outreach channel configuration for email, LinkedIn and WhatsApp, each declaring automated sending as not permitted
- [x] 4.9 Export the derived TypeScript union types (`CountryId`, `CityId`, `IndustryId`, `ServiceId`, `LeadStatus`, `LeadPriority`, `OutreachChannel`, `ScoreComponentId`) from the package root
- [x] 4.10 Add unit tests covering every scenario in `specs/product-configuration/spec.md`, including the boundary cases 90/89/80/79/70/69 and each rejection path
- [x] 4.11 Verify: `pnpm --filter @mela/config lint typecheck test` passes and every product-configuration scenario has a corresponding test

## 5. Shared utilities

- [x] 5.1 Create `packages/shared` package skeleton with the same script and export conventions as `packages/config`
- [x] 5.2 Implement `normalizeDomain` (lowercase host, strip scheme, leading `www.`, port, path, query and fragment) returning `null` for absent or unparseable input
- [x] 5.3 Implement `normalizeCompanyName` (lowercase, collapse whitespace, strip punctuation and common legal suffixes including LLC, L.L.C., FZE, FZ-LLC, Ltd, Limited, WLL, PJSC, LLC-FZ)
- [x] 5.4 Add the `Unknown` marker type and helpers that map SQL `null` to and from it, so consumers never see an empty string standing in for a missing fact
- [x] 5.5 Add unit tests covering the spec's normalization cases plus unparseable, IDN, subdomain and trailing-dot inputs
- [x] 5.6 Verify: `pnpm --filter @mela/shared lint typecheck test` passes

## 6. Database (Phase 2)

- [x] 6.1 Create `packages/database` skeleton with Drizzle ORM, `drizzle-kit`, `postgres` driver and `uuidv7`; add `drizzle.config.ts` reading the validated database env
- [x] 6.2 Add the connection module exporting a pooled client and a `withTransaction` helper, plus a `closeConnection` used by tests
- [x] 6.3 Define the PostgreSQL enum types for lead status, lead priority, outreach channel, outreach status and certainty, derived from `@mela/config` values
- [x] 6.4 Add the `companies` table: columns, `NOT NULL` discovery source, partial unique index on `normalized_domain`, and the filter indexes from design D6
- [x] 6.5 Add the `contacts` table with `ON DELETE CASCADE` to companies and the `CHECK` constraint requiring a source URL whenever an email or phone is present
- [x] 6.6 Add the Zod schemas for JSONB payloads (`observation`, `businessOpportunity`, `technologyEvidence`), each requiring evidence and a `certainty` of `observed` or `inferred`
- [x] 6.7 Add the `website_analysis` table with the JSONB columns, 0–100 `CHECK` constraints on every score, and the `(company_id, created_at DESC)` index
- [x] 6.8 Add the `leads` table with the per-component score breakdown, unique `company_id`, `CHECK` constraints for total range and non-empty explanation, and the priority and score indexes
- [x] 6.9 Add the `outreach` table with the `CHECK` constraint preventing a sent state without an approval timestamp and preventing a sent timestamp earlier than approval
- [x] 6.10 Add validated insert and update helpers as the package's public write API (rejecting unknown country, city, industry and service identifiers) and export the raw tables for reads only
- [x] 6.11 Add `applyLeadStatusChange` enforcing `canTransition` and bumping `updated_at`, rejecting impermissible transitions without writing
- [x] 6.12 Generate the initial migration with `drizzle-kit generate`, commit the SQL, and add `db:migrate`, `db:check` and `db:studio` scripts
- [x] 6.13 Add `getLatestWebsiteAnalysis(companyId)` and confirm it returns the most recently created row
- [x] 6.14 Add the seed script: a small labelled example dataset, idempotent on re-run, refusing to run unless the target database is designated as development
- [x] 6.15 Add the integration test harness (create/reset a dedicated test database, apply migrations, truncate between tests)
- [x] 6.16 Add integration tests covering every scenario in `specs/lead-data-model/spec.md`: source requirement, unknown-identifier rejection, duplicate domain, multiple website-less companies, cascade deletes, score range refusals, single lead per company, transition legality, approval-before-sent, migration idempotency, drift detection and seed idempotency
- [x] 6.17 Verify: migrations apply to an empty database, `pnpm db:check` reports no drift, and `pnpm --filter @mela/database test` passes with the Compose stack running

## 7. API application shell

- [x] 7.1 Scaffold `apps/api` as a NestJS 11 application wired to the shared tsconfig, ESLint config and Vitest setup, with `dev`, `build`, `lint`, `typecheck` and `test` scripts
- [x] 7.2 Bootstrap the app against the validated API env, with a global validation pipe, a global route prefix, and CORS permitting the web origin
- [x] 7.3 Add the database module providing the Drizzle client via Nest DI and closing the pool on shutdown
- [x] 7.4 Add the Redis module providing a client used only by the health check, closing on shutdown
- [x] 7.5 Add the health module using `@nestjs/terminus` with a Postgres `SELECT 1` check and a Redis `PING` check, each bounded by a 2-second timeout, returning 503 when any check fails
- [x] 7.6 Configure structured JSON logging outside development and confirm no connection string or credential appears in startup or error output
- [x] 7.7 Add API tests: healthy response shape, 503 with Postgres stopped naming Postgres as unreachable and Redis as reachable, timeout behaviour, and absence of credentials in the failure body
- [x] 7.8 Verify: `pnpm --filter @mela/api lint typecheck test build` passes and `GET /health` returns healthy against the running Compose stack

## 8. Web application shell

- [x] 8.1 Scaffold `apps/web` as a Next.js 16 App Router application with React 19, TypeScript and the shared tooling configs
- [x] 8.2 Configure Tailwind CSS and initialise shadcn/ui, committing the generated components directory and the design tokens
- [x] 8.3 Build the application shell: root layout, header, sidebar navigation placeholders and a placeholder dashboard area
- [x] 8.4 Add server-side fetching of the API health endpoint with a bounded timeout, rendering a healthy state and a clearly-labelled degraded state, never an unhandled error page
- [ ] 8.5 Add Playwright to `apps/web` with a smoke test asserting the shell renders and shows API status in both the healthy and unavailable cases
- [ ] 8.6 Verify: `pnpm --filter @mela/web lint typecheck test build` passes and the shell renders correctly with the API both running and stopped

## 9. Continuous integration and documentation

- [ ] 9.1 Add `.github/workflows/ci.yml` running on push and pull request: checkout, pnpm and Node setup with caching, install with a frozen lockfile
- [ ] 9.2 Add PostgreSQL and Redis service containers to the test job with health gating, and run `lint`, `typecheck`, `test` (including migrations and database integration tests) and `build`
- [ ] 9.3 Confirm the workflow contains no publish or deploy step and that a deliberately broken type fails the run
- [ ] 9.4 Write `README.md`: what the product is, prerequisites, first-time setup, the command set, and a link to the deeper docs
- [ ] 9.5 Write `docs/development.md` (pinned versions, starting and stopping services, migrations, seeding, running each test suite, troubleshooting on Windows)
- [ ] 9.6 Write `docs/architecture.md` and `docs/data-model.md` describing only what now exists, sourced from `design.md`
- [ ] 9.7 Write `docs/implementation-progress.md` recording this change as complete and listing Phases 3–17 as not started
- [ ] 9.8 Verify: every command, path and capability named in the documentation exists in the repository

## 10. Final verification

- [ ] 10.1 From a clean clone on a machine with Docker running: install, start the stack, migrate, seed, and start both applications; confirm `/health` is healthy and the web shell renders
- [ ] 10.2 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 10.3 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test or a recorded manual verification; list any that do not
- [ ] 10.4 Run `openspec validate bootstrap-project-foundation --strict` and resolve anything it reports
