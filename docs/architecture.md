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
