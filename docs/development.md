# Development Guide

## Pinned Versions

- **Node.js**: 22.x
- **pnpm**: 11.x
- **PostgreSQL**: 17
- **Redis**: 7

## Starting and Stopping Services

### Backing Services (Docker)

```bash
# Start PostgreSQL and Redis
docker compose up -d

# Stop services
docker compose down

# Stop and remove volumes (fresh start)
docker compose down -v

# View logs
docker compose logs -f postgres
docker compose logs -f redis
```

### Applications

```bash
# Start all applications
pnpm dev

# Start API only
pnpm --filter @mela/api dev

# Start Web only
pnpm --filter @mela/web dev
```

## Migrations

```bash
# Generate migration from schema changes
pnpm --filter @mela/database db:generate

# Apply pending migrations
pnpm --filter @mela/database db:migrate

# Open Drizzle Studio (GUI)
pnpm --filter @mela/database db:studio
```

## Rebuilding the database

Two destructive commands. Both drop every table and re-apply the migrations;
they differ only in what is written afterwards.

```bash
# Empty database, sign-in account restored, no example data
pnpm db:fresh

# The same, then the full example dataset
pnpm db:fresh:seed
```

Both recreate the local development account, so signing in works immediately
either way. Use `pnpm db:fresh` to see the interface with nothing in it —
every empty state, on every page.

To write the example dataset into a database you have already migrated,
without dropping anything:

```bash
pnpm db:seed:data
```

### What the example dataset contains

26 companies across all five industries and all four cities, at different
points in the pipeline, chosen to exercise the interface rather than to look
tidy — including a company with no website, an analysis that was blocked, a
score that was never measured, a lead with no summary, a refused draft, and
both a company-wide and a personal do-not-contact marker. Outreach covers
draft, pending approval, approved, sent, replied and rejected.

Every row is marked `is_example`, named "Example …", and hosted under a
reserved example domain.

**Two independent guards.** Seeding is refused unless `NODE_ENV` is
`development` or `test` **and** the database host is on this machine. There
is no override flag. The seed also refuses if no enabled operator account
exists, because approvals and sends record the account that acted and the
database rejects those rows unattributed — which is why `db:fresh:seed`
creates the account before seeding.

## Authentication

Every route requires a signed-in session — there is no sign-up page. Set
`SESSION_SECRET` in `.env` (32+ characters; the API refuses to start
outside development without one), then create your first account:

```bash
pnpm --filter @mela/api create-account -- --email=you@example.com --role=operator
```

This reads the password from the terminal with the input masked, refuses
anything shorter than the configured minimum, and never writes it to a
log or the process's argument list. `--role` is `operator` or `viewer`
(see `README.md` for what each can do). Once an operator account exists,
further accounts can also be created through `POST /api/accounts`.

Sign in at `/sign-in` in the web app, or `POST /api/auth/sign-in` directly
against the API.

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @mela/config test
pnpm --filter @mela/shared test
pnpm --filter @mela/database test
pnpm --filter @mela/api test

# Run API tests with Vitest UI
pnpm --filter @mela/api test:watch

# Run Playwright tests (web)
pnpm --filter @mela/web test
pnpm --filter @mela/web test:ui
```

## Website Analysis

### Browser Installation

The website analysis module uses Playwright for browser capture. Install the browser before running analysis tests:

```bash
# Install Playwright browsers (Chromium only)
npx playwright install chromium

# Or install all browsers
npx playwright install
```

### Artifact Directory

Analysis artifacts (screenshots, HTML, audit reports) are stored in `./analysis-artifacts` by default. This directory is gitignored.

To change the location, set `ANALYSIS_ARTIFACT_ROOT` in your `.env` file:

```
ANALYSIS_ARTIFACT_ROOT=/path/to/artifacts
```

## Troubleshooting on Windows

### Port Already in Use

If port 3000 or 4000 is already in use:

```bash
# Find process using the port
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <PID> /F
```

### Line Ending Issues

The project uses `.gitattributes` to enforce LF line endings. If you encounter issues:

```bash
# Re-normalize line endings
git add --renormalize .
git commit -m "fix: normalize line endings"
```

### Docker Compose Issues

If Docker Compose fails to start:

```bash
# Check Docker status
docker info

# Remove old volumes and start fresh
docker compose down -v
docker compose up -d
```

### Node Modules Issues

If you encounter module resolution issues:

```bash
# Clean install
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
pnpm install
```

### TypeScript Errors

If TypeScript reports missing types:

```bash
# Rebuild TypeScript
pnpm typecheck
```

### ESLint Errors

If ESLint reports configuration issues:

```bash
# Check ESLint config
pnpm lint
```
