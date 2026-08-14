# MELA — Middle East Lead Agent

AI-assisted B2B lead generation and sales intelligence platform for the Middle East market.

> **No authentication.** Neither the web application nor the API has an authentication layer. Both are intended to be run locally only, until an authentication capability is added.

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
```

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
