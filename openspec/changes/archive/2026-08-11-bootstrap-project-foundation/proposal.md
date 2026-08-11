# Bootstrap Project Foundation

**Roadmap coverage:** Phase 0 (Product Definition), Phase 1 (Project Foundation), Phase 2 (Database) of the master implementation roadmap.

## Why

The repository is empty apart from tooling configuration — there is no application, no database, and no shared vocabulary for the domain. Every later phase of the platform (discovery, verification, website analysis, opportunity analysis, scoring, outreach) depends on three things existing first: a single configurable definition of the product's domain (countries, cities, industries, services, statuses, scoring weights), a running local development environment, and the persisted data model that every service reads and writes.

Building those three together as one foundation avoids the usual failure mode of scaffolding an app, then discovering the domain vocabulary was hardcoded across a dozen files and the schema does not support the evidence-tracking the product principles demand.

## What Changes

**Monorepo and tooling**

- Create a pnpm + Turborepo monorepo at the repository root with `apps/web`, `apps/api`, and `packages/*` workspaces.
- Add shared TypeScript configuration, ESLint + Prettier, and Vitest wiring so `lint`, `typecheck`, `test`, and `build` run across every workspace from the root.
- Add a GitHub Actions workflow that runs those four checks on push and pull request. No deployment pipeline.

**Local infrastructure**

- Add a Docker Compose stack providing PostgreSQL 17 and Redis 7 for local development.
- Add typed, Zod-validated environment loading with a committed `.env.example` and a git-ignored `.env.local`.

**Applications (shells only)**

- Scaffold `apps/api` as a NestJS application exposing a health endpoint that reports its own status plus PostgreSQL and Redis reachability.
- Scaffold `apps/web` as a Next.js 16 / React 19 App Router application with Tailwind CSS and shadcn/ui initialised, rendering a placeholder dashboard shell that reads the API health endpoint.
- No authentication. No queue processing. No AI calls. No Playwright/Lighthouse analysis.

**Product configuration**

- Add `packages/config` as the single source of truth for target countries, cities, industries, offered services, lead statuses and their allowed transitions, lead priority bands, outreach channels, and lead scoring weights.
- All values are data with Zod schemas and derived TypeScript types, so adding a city or industry is a configuration edit, not a code change.

**Data model**

- Add `packages/database` with Drizzle ORM schema, migrations, and a typed client for the five core tables: `companies`, `contacts`, `website_analysis`, `leads`, `outreach`.
- Model evidence explicitly: every claim-bearing field carries its source, source URL, and a confidence/certainty marker so `observed`, `inferred`, and `unknown` are distinguishable in the database rather than by convention.
- Add a deterministic seed script and integration tests covering migrations, constraints, and lead status transitions.

## Capabilities

### New Capabilities

- `product-configuration`: The configurable domain vocabulary of the platform — target countries and cities, industries, offered services, lead lifecycle statuses and legal transitions, priority bands, outreach channels, and lead scoring weights — exposed as validated, typed configuration rather than hardcoded literals.
- `lead-data-model`: The persisted representation of companies, contacts, website analyses, leads, and outreach records, including evidence provenance (source, source URL, certainty), uniqueness and deduplication constraints, and controlled lead status transitions.
- `developer-environment`: The reproducible local and CI environment — workspace commands, containerised PostgreSQL and Redis, validated environment variables, and an API health endpoint that reports dependency reachability.

### Modified Capabilities

None. This is the first change in the repository; `openspec/specs/` is empty.

## Non-goals

Deliberately deferred to later changes:

- **Authentication and authorization** — the app runs unauthenticated on localhost until Phase 17. No user table in this change.
- **Company discovery, verification, website analysis, technology detection, opportunity analysis, decision maker research, scoring engine, research summaries, outreach generation** — Phases 3–11. This change creates the tables they will write to, not the services.
- **AI provider abstraction and any LLM calls** — Phase 7. No AI dependency is installed here.
- **BullMQ queues and workers** — Phase 15. Redis is provisioned so the health check and later phases have it available, but no queue, job, or worker is created.
- **Playwright browser automation and Lighthouse** — Phase 5. Playwright is installed only as the E2E test runner, not as an analysis tool.
- **Real dashboard UI, lead list, lead detail, filters, charts** — Phase 12. `apps/web` ships as a shell.
- **Deployment, AWS resources, S3, CloudWatch, Secrets Manager** — Phases 16–17. CI runs tests only.

## Impact

- **New code:** entire repository tree — `apps/web`, `apps/api`, `packages/config`, `packages/database`, `packages/shared`, root workspace and tooling configuration, `docker-compose.yml`, `.github/workflows/ci.yml`, `docs/`.
- **New runtime dependencies:** Docker (PostgreSQL, Redis) must be running for the API health check, database tests, and migrations to pass locally.
- **New external dependencies:** pnpm 9+, Node 22+, Docker Desktop. No paid or API-key-requiring services are introduced by this change.
- **Downstream contract:** every later phase consumes `packages/config` for domain vocabulary and `packages/database` for persistence. Changing a status name or scoring weight after this change lands is a configuration edit plus a migration, not a refactor.
- **Data:** no production data exists. The seed script creates clearly-marked example rows for local development only and must never be run against a shared database.
