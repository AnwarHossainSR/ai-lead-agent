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

# Apply database migrations
pnpm --filter @mela/database db:migrate

# Seed the database (development only)
pnpm --filter @mela/database db:seed

# Create your first account — there is no sign-up page
pnpm --filter @mela/api create-account -- --email=you@example.com --role=operator
```

## Accounts and roles

Every route requires signing in. There is no sign-up: the only way to
create an account is the `create-account` command above (prompts for a
password on the terminal, never echoed) or the operator-only
`POST /api/accounts` endpoint once at least one operator account exists.

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
pnpm --filter @mela/api dev      # API on port 3001
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
| `pnpm --filter @mela/database db:migrate` | Apply pending migrations |
| `pnpm --filter @mela/database db:generate` | Generate migration files |
| `pnpm --filter @mela/database db:seed` | Seed the database |
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
