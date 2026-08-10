# Design — Bootstrap Project Foundation

## Context

The repository contains only `.claude/` and `openspec/`. There is no code, no `package.json`, no git history beyond the OpenSpec skills commit. Everything in this change is greenfield, so there is nothing to migrate away from and no backwards compatibility to preserve.

See `proposal.md` — Why for motivation, and `specs/*/spec.md` for the behavioral requirements this design has to satisfy.

Constraints that shape the design:

- The stack is decided (see `openspec/config.yaml` context). Deviations need a stated reason.
- Development happens on Windows 11 with Docker Desktop. Paths, line endings and container networking must work there without WSL-only tricks.
- Later phases add nine research services, a worker fleet and an AI abstraction. The layout must absorb those without a restructure.
- The product principles forbid fabricated data, so "unknown" has to be a first-class value in the schema, not an empty string.

## Goals / Non-Goals

**Goals**

- A single `pnpm install && docker compose up -d && pnpm dev` path from clone to running system.
- Domain vocabulary in exactly one place, typed, validated, and consumable by both applications.
- A schema that can record provenance and certainty for every researched claim from day one, so Phases 3–11 never have to retrofit it.
- Root-level `lint`, `typecheck`, `test`, `build` that CI runs unmodified.

**Non-Goals (design level)**

- No shared UI component package. `shadcn/ui` components live in `apps/web` until a second consumer exists.
- No repository/service abstraction layer over Drizzle beyond thin typed functions. Drizzle's query builder is the data access API.
- No dependency injection wiring in `packages/*`. They export plain functions and objects; only `apps/api` uses Nest DI.
- No runtime configuration UI or database-backed settings. Configuration is code in this change.
- No observability stack. Structured console logging only.

## Decisions

### D1 — pnpm workspaces + Turborepo, `apps/` and `packages/` split

**Choice:** `apps/web`, `apps/api`, `packages/config`, `packages/database`, `packages/shared`, plus `packages/tsconfig` and `packages/eslint-config` as tooling presets. `workers/` is created empty-by-omission — it arrives in Phase 15.

```
middle-east-lead-agent/
├─ apps/
│  ├─ api/                    NestJS 11 — REST API
│  └─ web/                    Next.js 16 App Router
├─ packages/
│  ├─ config/                 domain vocabulary + env schemas (Zod)
│  ├─ database/               Drizzle schema, migrations, client, seed
│  ├─ shared/                 normalization, result types, cross-cutting utils
│  ├─ tsconfig/               shared tsconfig bases
│  └─ eslint-config/          shared flat ESLint config
├─ docs/
├─ .github/workflows/ci.yml
├─ docker-compose.yml
├─ turbo.json
├─ pnpm-workspace.yaml
└─ package.json
```

**Why:** Turborepo's task graph gives correct build ordering (`config` → `database` → `api`/`web`) and caching for the four root commands the CI workflow runs. pnpm's strict node_modules prevents phantom dependencies, which matters when `packages/database` must not accidentally resolve a Nest import.

**Alternatives:** npm/yarn workspaces without Turbo (no task graph, root commands become hand-written `--filter` chains); Nx (heavier, generators and plugins we would not use).

### D2 — NestJS API as a separate application, not Next.js Route Handlers

**Choice:** All backend behavior lives in `apps/api`. `apps/web` calls it over HTTP and holds no business logic.

**Why:** Phase 15 runs the same services inside BullMQ workers. Nest modules and providers are reusable in a worker process; Next Route Handlers are not. Splitting later would mean rewriting every service.

**Trade-off:** two processes in development and CORS/base-URL configuration that a single Next app would not need. Accepted — `pnpm dev` runs both, and `NEXT_PUBLIC_API_URL` plus a server-side `API_URL` cover it.

### D3 — Domain configuration as typed code in `packages/config`, not database rows

**Choice:** Countries, cities, industries, services, statuses, transitions, priority bands, scoring weights and outreach channels are TypeScript object literals validated by Zod at module load, exported `as const` and frozen with `Object.freeze`.

**Why:** These values are referenced at compile time (a `ServiceId` union type, an exhaustive `switch` over statuses) and change at the pace of product decisions, not user actions. Code review and git history are the right change-control mechanism. Database-backed configuration adds a load path, a cache, and a class of "config drifted between environments" bugs for no current benefit.

**Alternatives:** JSON/YAML files parsed at startup (loses compile-time types); database tables (premature; revisit if a non-engineer ever needs to edit them).

**Validation timing:** the Zod parse runs at module evaluation, so an invalid edit fails `pnpm typecheck`-adjacent unit tests and fails application startup — never silently at request time.

### D4 — Two-tier enforcement of configuration identifiers in the database

The database cannot validate a text column against a TypeScript array, so identifier integrity is split by how often the set changes:

| Set | Storage | Enforcement |
|---|---|---|
| lead status, lead priority, outreach channel, outreach status, certainty | PostgreSQL `enum` types | Database constraint + TS union |
| country, city, industry, service | `text` columns | Zod validation at the data-access boundary |

**Why:** Statuses and channels are stable and a bad value there corrupts the lifecycle, so the database should refuse it. Countries, cities and industries are explicitly designed to grow through configuration edits; putting them in PG enums would mean a migration for every new city, defeating the point of `product-configuration`.

**Consequence:** every write path into `companies` and `leads` goes through a Zod-validated insert helper in `packages/database`. Raw `db.insert(companies)` bypasses validation, so the helpers are the public export and the raw tables are exported only for queries.

### D5 — Representing observed / inferred / unknown

Three mechanisms, applied by field shape:

1. **Unknown = SQL `NULL`.** Nullable columns with no default. The read layer maps `null` to an explicit `unknown` marker in the domain type rather than to `""` or `0`, so a missing accessibility score can never be mistaken for a score of zero. Empty strings are rejected at the boundary.
2. **Provenance columns.** `source` and `source_url` sit next to every researched claim on `companies` and `contacts`. `NOT NULL` on discovery source for companies. A contact email or phone requires its own `source_url` — enforced by a `CHECK` constraint (`email IS NULL OR source_url IS NOT NULL`).
3. **Structured evidence in JSONB.** `website_analysis.observations`, `website_analysis.business_opportunities` and `website_analysis.technology_stack` are `jsonb` columns whose contents are defined by Zod schemas in `packages/database/src/schemas/`. Each observation carries `{ statement, evidence, evidenceUrl, certainty }` where `certainty` is `observed | inferred`. Nothing is stored without evidence.

**Why JSONB over normalized tables:** the shape of an observation is still being discovered (Phases 5–7 will refine it). JSONB with a Zod contract lets the shape evolve without a migration per iteration, while `jsonb_path_ops` indexes stay available if querying inside observations ever matters. Once the shape stabilises, promoting to real tables is a contained migration.

**Trade-off:** no referential integrity inside JSONB. Mitigated by validating on write and on read, and by keeping anything the UI filters or sorts on (scores, statuses, priorities) in real columns.

### D6 — Drizzle schema layout and migration workflow

**Choice:** One file per table in `packages/database/src/schema/`, re-exported from an index. `drizzle-kit generate` produces timestamped SQL in `packages/database/drizzle/`, which is committed. `drizzle-kit migrate` applies them. `drizzle-kit check` is wired into the `db:check` script and runs in CI to catch schema/migration drift.

**Why:** Committed SQL is reviewable, reproducible and deployable without the ORM being present. `drizzle-kit push` is convenient but leaves no history — it is used for nothing in this project.

**Uniqueness:** `companies.normalized_domain` gets a *partial* unique index (`WHERE normalized_domain IS NOT NULL`), so multiple website-less companies coexist while duplicate domains are rejected by the database. `leads.company_id` gets a plain unique index. Foreign keys use `ON DELETE CASCADE` from `companies` to `contacts`, `website_analysis` and `leads`, and from `leads` to `outreach`.

**Indexes created now:** `companies(country_id, city_id, industry_id)`, `companies(status)`, `leads(priority)`, `leads(lead_score DESC)`, `website_analysis(company_id, created_at DESC)`, `outreach(lead_id, status)`. These back the Phase 12 dashboard's filters and the "latest analysis" lookup.

**Identifiers:** UUID v7 generated in the application (`uuidv7`), stored as `uuid`. Time-ordered UUIDs keep index locality without exposing a sequential count.

**Timestamps:** `timestamptz`, `defaultNow()`, with `updated_at` maintained by the application on every write (not a trigger — one mechanism, visible in code).

### D7 — Normalization lives in `packages/shared`, not `packages/database`

`normalizeDomain` and `normalizeCompanyName` are pure functions with no database dependency, unit-tested exhaustively against the cases in the spec. Phase 3's discovery pipeline needs them before anything is persisted, so they cannot live behind the database package.

### D8 — Environment validation

`packages/config/src/env/` exports one Zod schema per consumer (`apiEnvSchema`, `webEnvSchema`, `databaseEnvSchema`). Each application parses `process.env` once at startup and exports the frozen result; nothing else reads `process.env` directly, enforced by an ESLint rule (`no-restricted-properties`).

`.env.example` is committed with placeholders and a comment per variable. A unit test asserts every key in the schemas appears in `.env.example`, which is how the spec's "example file is complete" scenario stays true over time.

**Which file holds the real values** — revised during implementation. The original plan named `.env.local` as the single local file. Docker Compose does not read `.env.local`; it auto-loads a root `.env` and otherwise needs an explicit `--env-file` on every invocation, which would make `docker compose up -d` no longer a single command. The layout is therefore:

| File | Read by | Committed |
|---|---|---|
| `.env.example` | nothing — it is the documented variable list | yes |
| `.env` (root) | Docker Compose, the API, and the packages | no |
| `apps/web/.env.local` | Next.js, for its own public variables | no |

Both real-value files are git-ignored. `apps/web/.env.local` exists because Next.js auto-loads that name; splitting it from the root `.env` also keeps `NEXT_PUBLIC_*` variables visibly separate from server-side ones.

### D9 — Health checks via `@nestjs/terminus`

`GET /health` returns `{ status, info, error, details }` with a Postgres `SELECT 1` check and a Redis `PING` check, each with a 2-second timeout, and returns HTTP 503 when any check fails. Terminus already implements the timeout, aggregation and status-code semantics the spec requires; hand-rolling it would be strictly more code for the same behavior.

Redis is checked even though nothing else uses it yet — it proves the container and connection string are correct before Phase 15 depends on them.

### D10 — Testing strategy

- **Vitest** for unit and integration tests, one Vitest project per package, aggregated by Turbo.
- **Unit tests** (no I/O): configuration validation, priority band classification, status transition legality, domain and name normalization, Zod schemas for observations, env schema completeness.
- **Integration tests** (real PostgreSQL): migrations apply from empty, every constraint in the spec actually rejects, seed idempotency. They run against the Docker Compose database using a dedicated `..._test` database created and truncated per run — not Testcontainers, which adds a heavy dependency for a service the developer already has running.
- **Playwright** installed in `apps/web` with one smoke test asserting the shell renders and displays API status. Real E2E coverage arrives in Phase 12.
- CI provides PostgreSQL and Redis as GitHub Actions service containers so the same integration tests run unchanged.

### D11 — Docker Compose

PostgreSQL 17-alpine and Redis 7-alpine, both with `healthcheck` blocks (`pg_isready`, `redis-cli ping`), named volumes (`pgdata`, `redisdata`), and host ports from `POSTGRES_PORT` / `REDIS_PORT` with defaults 5432 and 6379. No application containers — the apps run on the host during development, which keeps hot reload fast on Windows.

### D12 — Logging

Nest's built-in `Logger` with a JSON formatter when `NODE_ENV !== 'development'`, pretty output otherwise. No pino, no transport, no correlation IDs in this change; request IDs and structured context arrive with Phase 17. The constraint that matters now is that no credential is ever logged, which D8 supports by keeping connection strings out of error messages.

## Risks / Trade-offs

- **Next.js 16 + React 19 + shadcn/ui compatibility** → shadcn components are copied into the repo rather than installed as a dependency, so any incompatibility is a local, editable file rather than a blocked upgrade. The scaffold task pins the exact versions that install cleanly and records them in `docs/development.md`.
- **Windows-specific friction** (line endings, path separators, Docker Desktop volume performance) → `.gitattributes` normalises line endings; all scripts use pnpm/Node APIs rather than shell builtins; no bind-mounted `node_modules`.
- **JSONB observations drift from their Zod schema over time** → validate on read as well as write, and version the observation schema shape so a future migration can detect and transform old rows.
- **Config identifiers stored as `text` allow bad data via raw SQL** → the raw Drizzle tables are exported for reads, and the validated insert helpers are the only documented write path; integration tests assert the helpers reject unknown identifiers.
- **Scoring weights are configuration but scores are stored as columns** → changing a component maximum does not retroactively rescore stored leads. Accepted for now; Phase 9 owns rescoring, and the stored per-component breakdown makes it possible.
- **Two-process development is easy to half-start** (web up, API down) → the shell's degraded state is a spec requirement precisely so this is obvious rather than a stack trace.
- **Empty Redis usage looks like dead weight** → it is one container and one health check; the alternative is discovering a broken connection string in Phase 15 with a worker on top of it.

## Migration Plan

There is nothing to migrate — the repository is empty. The rollout is the task order in `tasks.md`, with these properties:

1. Each task is a separate conventional commit on a feature branch off `dev`.
2. The database is created by migrations only. Applying all migrations to an empty database is verified in CI, so "it works on my machine" cannot hide a missing migration.
3. Rollback for any task is `git revert` plus, for database tasks, dropping the local development database and re-running migrations. No production data exists, so no down-migrations are written.
4. The change is complete when `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes from a clean clone with the Compose stack up, and `GET /health` returns healthy.

## Open Questions

These can be answered later without changing the specs, the design or the task breakdown:

- Which AI provider is implemented first behind the abstraction — decided in Phase 7, affects no foundation code.
- Which company discovery data source is used first — decided in Phase 3; `companies.source` is already free text with a URL.
- Whether `packages/shared` eventually splits into `shared-types` and `shared-utils` — revisit when it exceeds roughly a dozen modules.
- Whether observations graduate from JSONB to normalized tables — revisit at the end of Phase 7, when the shape has stopped moving.
