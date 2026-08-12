# AGENTS.md — MELA Project Instructions

## Project Overview

MELA (Middle East Lead Agent) is an AI-assisted B2B lead generation platform built as a TypeScript monorepo.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Backend**: NestJS 11 + TypeScript
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS
- **Database**: PostgreSQL 17 + Drizzle ORM
- **AI**: Provider abstraction (Gemini / Cloudflare Workers AI) with versioned prompts
- **Validation**: Zod at every trust boundary
- **Testing**: Vitest (unit + integration), Playwright (E2E)
- **Linting/Formatting**: Biome

## Repository Structure

```
apps/
  api/          # NestJS REST API
  web/          # Next.js web application
packages/
  config/       # Environment and product configuration
  database/     # Drizzle ORM schemas and migrations
  shared/       # Shared utilities
  tsconfig/     # Shared TypeScript configs
  ai/           # AI provider abstraction and prompt registry
openspec/
  changes/      # Active spec-driven changes
  archive/      # Completed changes
  specs/        # Cross-cutting specifications
docs/           # Architecture, data model, implementation progress
```

## How to Work Here

1. **Read before editing** — check `openspec/changes/<change>/tasks.md` for the active change, and `docs/implementation-progress.md` for what is done and what is next.
2. **Small commits** — each task in `tasks.md` is one conventional commit. Implement one task, run the relevant checks, report, and stop for approval.
3. **Run the real checks** — never claim lint, typecheck, test or build passed unless it actually ran and passed. Use the workspace commands, not bare binaries, so Turborepo caching and dependency ordering work.
4. **No fabrication** — contact details, scores, technologies and opportunities are never invented. If evidence is missing, record it as missing or unknown.
5. **Observed vs inferred vs unknown** — keep these distinguishable in the schema, the API and any UI you touch.
6. **Deterministic code decides** — scoring, deduplication, verdicts, transitions and validation contain no model call. The model interprets, summarizes, classifies and personalizes.
7. **Human approval before outreach** — no transport, sending credential, auto-send scheduler or batch-send endpoint may be added.
8. **No anti-bot evasion** — a blocked source is recorded and left alone.

## Commands

```bash
pnpm dev                  # Start all apps
pnpm build                # Build all packages
pnpm test                 # Run all tests
pnpm lint                 # Run Biome across the monorepo
pnpm typecheck            # TypeScript type checking
pnpm biome:check          # Biome check without write
```

### Database

```bash
pnpm --filter @mela/database db:migrate   # Apply migrations
pnpm --filter @mela/database db:generate  # Generate migration
pnpm --filter @mela/database db:seed      # Seed development data
```

### Package-specific

```bash
pnpm --filter @mela/api test
pnpm --filter @mela/database test
pnpm --filter @mela/config test
```

## Active Change

See `openspec/changes/` for the current change. Work through its `tasks.md` in order, one task at a time.

## Constraints

- **Never commit secrets** — `.env` is gitignored; `.env.example` contains only placeholders.
- **No deployment changes** unless the active change explicitly includes them.
- **No new dependencies** without checking the catalog in `pnpm-workspace.yaml` first.
- **No edits to `packages/database/drizzle/`** — generated files are committed by `db:generate`.
