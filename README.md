# MELA — Middle East Lead Agent

AI-assisted B2B lead generation and sales intelligence platform for the Middle East market.

## Prerequisites

- **Node.js** 22+ (recommend using [nvm](https://github.com/nvm-sh/nvm))
- **pnpm** 11+
- **Docker** and **Docker Compose**

## First-Time Setup

```bash
# Clone the repository
git clone <repo-url>
cd ai-lead-agent

# Install dependencies
pnpm install

# Copy environment files
cp .env.example .env
cp .env.example apps/web/.env.local

# Start backing services
docker compose up -d

# Build the database: drop everything, migrate, and create the sign-in account
pnpm db:fresh

# Or the same, plus the full example dataset
pnpm db:fresh:seed

# Or create your own account instead — there is no sign-up page
pnpm --filter @mela/api create-account -- --email=you@example.com --role=operator
```

### Rebuilding the database

Two commands, both destructive — they drop every table and re-apply the
migrations. The difference is what is written afterwards:

| Command | Result |
|---------|--------|
| `pnpm db:fresh` | An empty database with the sign-in account restored. Nothing else. |
| `pnpm db:fresh:seed` | The same, then the full example dataset. |

The account is recreated by both, so signing in works immediately either way.
`db:fresh` is the one to use when you want to see the interface with no data
in it — every empty state, on every page.

## Accounts and roles

Every route requires signing in. There is no sign-up: an account comes from
the `create-account` command above (prompts for a password on the terminal,
never echoed), the `seed:accounts` script below, or the operator-only
`POST /api/accounts` endpoint once at least one operator account exists.

### Local development account

`pnpm db:seed:dev` (or `pnpm --filter @mela/api seed:accounts` on its own)
creates one account and nothing else — no companies, no leads, no drafts:

| Email | Password | Role |
|-------|----------|------|
| `dev@mela.local` | `DevPassword123!` | operator |

### The example dataset

`pnpm db:fresh:seed` writes a dataset built to exercise the interface rather
than to look tidy: 26 companies across all five industries and all four
cities, carried to different points in the pipeline. It deliberately includes
the states a hand-made fixture forgets — a company with no website at all, an
analysis that was blocked rather than merely low-scoring, a score that was
never measured, a lead nobody has summarised, a draft a reviewer refused, and
both a company-wide and a personal do-not-contact marker. Outreach covers
every status a reviewer can meet: draft, pending approval, approved, sent,
replied and rejected.

Every row is marked `is_example`, named "Example …", and hosted under a
reserved example domain, so a seeded row cannot be mistaken for a researched
one. Approvals, rejections and sends are attributed to a real account — the
database refuses them otherwise — which is why the seed runs after the
account is created and refuses outright if no operator exists.

`pnpm db:seed:data` writes it into a database you have already migrated,
without dropping anything.

The sign-in form prefills the operator one in development, so signing in
locally is a single click. Nothing about this reaches a deployment: the
script refuses to run unless `NODE_ENV` is `development` or `test` **and**
the database is on this machine, and the prefill is forced empty when
`NODE_ENV=production`. Set `DEV_SIGN_IN_EMAIL` / `DEV_SIGN_IN_PASSWORD` in
`apps/web/.env.local` to prefill a different account.

Two roles:

- **operator** — can approve or reject outreach, record a manual send, set
  or clear a do-not-contact marker, and trigger anything that calls a
  model, in addition to everything a viewer can do.
- **viewer** — read-only. Can sign in and see everything, but the API
  refuses any of the actions above regardless of what the web app shows.

## Development

```bash
# Start all applications
pnpm dev

# Or start individually
pnpm --filter @mela/api dev      # API on port 4000
pnpm --filter @mela/web dev      # Web on port 3000
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all applications in development mode |
| `pnpm build` | Build all applications for production |
| `pnpm lint` | Run Biome across the monorepo |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm test` | Run all test suites |
| `pnpm biome` | Format and fix lint issues with Biome |
| `pnpm biome:check` | Check formatting and lint without writing |

### Database

| Command | Description |
|---------|-------------|
| `pnpm db:fresh` | **Destructive.** Drop everything, migrate, restore the sign-in account. No example data |
| `pnpm db:fresh:seed` | **Destructive.** The same, then write the full example dataset |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:reset` | **Destructive.** Drop every table and re-apply migrations. Writes nothing |
| `pnpm db:seed:data` | Write the example dataset into an already-migrated database |
| `pnpm db:seed:accounts` | Create the local development account, and nothing else |
| `pnpm --filter @mela/database db:generate` | Generate migration files |
| `pnpm --filter @mela/database db:studio` | Open Drizzle Studio |

### Individual Packages

```bash
# API
pnpm --filter @mela/api test
pnpm --filter @mela/api lint
pnpm --filter @mela/api typecheck

# Web
pnpm --filter @mela/web test
pnpm --filter @mela/web lint
pnpm --filter @mela/web typecheck

# Database
pnpm --filter @mela/database test

# Config
pnpm --filter @mela/config test

# Shared
pnpm --filter @mela/shared test
```

## Project Structure

```
ai-lead-agent/
├── apps/
│   ├── api/          # NestJS REST API
│   └── web/          # Next.js web application
├── packages/
│   ├── config/       # Environment and product configuration
│   ├── database/     # Drizzle ORM schemas and migrations
│   ├── shared/       # Shared utilities
│   └── tsconfig/     # Shared TypeScript configs
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed architecture documentation.

## Data Model

See [docs/data-model.md](docs/data-model.md) for database schema documentation.

## License

Private — All rights reserved.
