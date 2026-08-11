# Architecture

## Overview

MELA (Middle East Lead Agent) is an AI-assisted B2B lead generation platform built as a TypeScript monorepo using pnpm workspaces and Turborepo.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Application                        │
│                    (Next.js 16 + React 19)                  │
│                     http://localhost:3000                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       REST API                              │
│                    (NestJS 11 + Drizzle)                    │
│                     http://localhost:3001                    │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Postgres │   │  Redis   │   │  Files   │
        │   17     │   │    7     │   │  (S3)    │
        └──────────┘   └──────────┘   └──────────┘
```

## Packages

### apps/api

NestJS REST API providing:
- Health check endpoints (`GET /health`)
- Discovery run endpoints (`POST /api/discovery/runs`, `GET /api/discovery/runs`, `GET /api/discovery/runs/:id`)
- Product configuration APIs
- Lead management endpoints
- Outreach management endpoints

### apps/web

Next.js 16 App Router application providing:
- Dashboard with API health status
- Navigation shell (sidebar + header)
- Server-side rendering with React 19

### packages/config

Centralized configuration package:
- Environment variable schemas (Zod)
- Product configuration (countries, industries, services)
- Lead lifecycle, priority, and scoring configuration

### packages/database

Database layer using Drizzle ORM:
- PostgreSQL schema definitions
- Type-safe write APIs
- Migration management
- Seed scripts

### packages/ai

The platform's only sanctioned path to a language model. Two layers:

- **`AIProvider`** — thin transport over one vendor (Gemini or Cloudflare Workers AI). Knows about messages, tokens and HTTP failures. Knows nothing about prompts, schemas or cost ceilings.
- **`AIService`** — the only thing application code calls. Resolves a prompt by name and version, renders it, calls the provider, validates output against a Zod schema (with one repair attempt), estimates cost, enforces the spend ceiling, and records every invocation.

Prompts are versioned modules reviewed like code (`src/prompts/<name>/v<n>.ts`). A published version is never edited. Output is requested as structured data via a single-tool definition and always parsed against the prompt's declared Zod schema — never coerced, never defaulted.

Every call is recorded in `ai_invocations` with the prompt name, version, model, token counts, estimated cost, latency, and outcome. No prompt text, no response text, no key is stored.

```
packages/ai/
├─ src/
│  ├─ provider/          AIProvider interface, Gemini + Cloudflare implementations, retry, errors
│  ├─ prompts/           PromptDefinition type, registry, render conventions, test-classify prompt
│  ├─ service/           AIService, output validation, cost estimation
│  └─ testing/           FakeAIProvider for deterministic tests
```

### packages/shared

Shared utilities:
- Domain normalization
- Company name normalization
- Unknown marker type helpers

### packages/tsconfig

Shared TypeScript configurations:
- `base.json` - Base configuration
- `node.json` - For packages and API
- `next.json` - For Next.js web app

### packages/eslint-config

Shared ESLint configuration:
- TypeScript rules
- `no-restricted-properties` for `process.env`
- Prettier integration

## Data Flow

1. **Web App** renders server-side, fetching from API
2. **API** processes requests, validates with Zod
3. **Database** handles persistence via Drizzle ORM
4. **Redis** used for health checks (future: caching, queues)

## Security Considerations

- Environment variables validated at startup via Zod
- `process.env` access restricted to `packages/config` only
- CORS configured for web origin only
- No credentials in health responses

## Company Discovery

The discovery module orchestrates finding new companies across configured territories and industries.

### Sources

Discovery sources are pluggable adapters that find companies:

- **`file_import`** — reads a CSV or JSON list the operator already has. The only source that contacts no third party.
- **`places`** — calls a licensed business listings API. Disabled by default; requires an API key.
- **`business_directory`** — reads a public directory. Not yet implemented.

Sources are configured in `packages/config/src/product/discovery-sources.ts` with:
- Identifier, display name, kind
- Whether the source is enabled
- Which countries it covers
- Maximum request rate per minute
- Crawl permission (defaults to denied)

### Run Lifecycle

1. **Validation** — territory and industry identifiers are validated against configuration
2. **Source Selection** — enabled sources covering the requested country are selected
3. **Rate Limiting** — sources are iterated through token buckets respecting configured rates
4. **Candidate Processing** — candidates are deduplicated, validated, and stored
5. **Limit Enforcement** — candidate and duration limits end the run early if hit
6. **Outcome Recording** — run completion records success, partial, failed, or limit_reached

### Design Decisions

- **No anti-bot evasion** — a source that blocks us is recorded as blocked and left alone
- **No fabrication** — candidates without a source URL are rejected; optional attributes stay absent when not provided
- **Deterministic deduplication** — domain first, then name within country, no LLM involvement
- **Human approval before outreach** — discovery finds companies; outreach requires explicit approval
