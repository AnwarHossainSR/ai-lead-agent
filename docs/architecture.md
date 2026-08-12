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
- Verification endpoints (`POST /api/companies/:id/verify`, `POST /api/verification/batch`, `GET /api/companies/:id/verification`)
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

## Company Verification

Verification confirms whether a discovered company's online presence is reachable and matches expectations. It runs deterministic checks (DNS, HTTP, domain-name-match) and optional registry lookups.

### Verification States

| State | Meaning |
|-------|---------|
| `never_checked` | No verification has been run yet |
| `verified` | All required checks passed |
| `unverified` | A required check failed |
| `unreachable` | Required checks returned unknown (timeout, block, no registry) |

**Why `unreachable` is distinct from `unverified`:** A company that times out or is blocked is not necessarily bad — the check infrastructure couldn't reach it. Marking it `unverified` would be incorrect; `unreachable` signals "we don't know yet" without claiming failure.

### Checks

| Check | Required | What it does |
|-------|----------|--------------|
| `dns` | Yes | Resolves A/AAAA + MX records for the domain |
| `http` | Yes | Fetches the website URL, follows redirects, detects blocks |
| `domain-name-match` | No | Deterministic token overlap between company name and domain |
| `registry` | No | Looks up the company in a country-specific business registry |

### Design Decisions

- **Evidence required** — a `passed` or `failed` verdict without evidence is downgraded to `unknown`
- **No anti-bot evasion** — a blocked host is recorded as `unknown` with `blocked` failure code
- **No language model** — all checks are deterministic; no LLM calls in the verification path
- **Staleness window** — companies are re-verified after 90 days by default
- **Bounded concurrency** — batch verification runs up to N checks in parallel

## Website Analysis

Website analysis captures a company's web presence using a headless browser, runs quality audits, and records observations. It provides the evidence needed for lead scoring and opportunity identification.

### Analysis Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Eligibility │────▶│   Capture   │────▶│    Audit    │────▶│   Record    │
│    Check     │     │  (Playwright)│     │ (Lighthouse)│     │  (Database) │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
  Skip if:            Capture at          Run Lighthouse       Store:
  - No website        desktop &           scoring via CDP      - Outcome
  - Unverified        mobile viewports    for performance,     - Scores
  - Blocked by        Record console      accessibility,       - Artifacts
    robots.txt        messages,           SEO, mobile, UX      - Observations
                      failed requests
```

### Analysis Outcomes

| Outcome | Meaning |
|---------|---------|
| `completed` | Full pipeline ran successfully |
| `partial` | Capture succeeded but audit failed |
| `blocked` | Host returned 403, 429 without retry-after, or bot challenge |
| `skipped` | Blocked by robots.txt or company not eligible |
| `failed` | Unexpected error during analysis |

### Why We Record Blocked Sites

A blocked site is recorded rather than evaded because:
1. **Transparency** — the user sees that the analysis couldn't complete
2. **No evasion** — we don't rotate user agents, solve CAPTCHAs, or disguise requests
3. **Future retry** — a blocked site can be re-analyzed later if the block is temporary
4. **Evidence** — the block itself is evidence about the company's web infrastructure

### Artifacts

Analysis artifacts are stored in `ANALYSIS_ARTIFACT_ROOT` (default: `./analysis-artifacts`):

```
analysis-artifacts/
├─ {companyId}/
│  ├─ {analysisId}/
│  │  ├─ desktop-screenshot.png
│  │  ├─ mobile-screenshot.png
│  │  ├─ rendered.html
│  │  └─ audit-report.json
```

### Observation Rules

Pure functions that check page captures for issues:
- No HTTPS
- Missing viewport meta tag
- Console errors
- Failed requests
- Missing or empty title
- Missing meta description
- Missing favicon
- Excessive page weight (>10MB)

### Design Decisions

- **Playwright for capture** — reliable, maintainable browser automation
- **Lighthouse for scoring** — industry-standard quality metrics
- **Two viewports** — desktop (1920×1080) and mobile (375×812)
- **Polite by default** — respects robots.txt, rate limits, and blocks
- **No score fabrication** — NULL means "not measured", not zero
- **Staleness window** — companies are re-analyzed after 30 days by default

## Technology Detection

Technology detection identifies the software stack behind a company's website by matching declared fingerprint patterns against what the analysis actually captured. It runs deterministically with no network requests and no language model calls.

### How It Works

1. **Fingerprint Matching** — Curated patterns are evaluated against captured content (headers, HTML, script URLs, stylesheet URLs, cookies, meta generator)
2. **Version Extraction** — A version is recorded only when it appears verbatim in the matched evidence; never inferred from behavior
3. **Implication Resolution** — Technologies implied by detected ones are marked as `inferred`, not `observed`
4. **Database Persistence** — Detections are attached to the analysis that produced them

### Why Fingerprints Are Curated

Fingerprints are manually curated rather than imported from public databases because:
- **Accuracy** — each pattern is verified to match the intended technology without false positives
- **Control** — we decide which technologies to detect and how patterns are expressed
- **Simplicity** — no need to parse and validate thousands of potentially conflicting patterns
- **Transparency** — every detection can be traced to a specific, human-reviewed pattern

### Why Versions Are Never Inferred

A version is recorded only when it appears verbatim in the matched evidence because:
- **Correctness** — inferring versions from behavior leads to wrong assumptions
- **Reproducibility** — the same capture always yields the same version (or no version)
- **Honesty** — "unknown version" is more truthful than a guess

### Match Locations

| Location | What it sees |
|----------|--------------|
| `header` | Response headers (e.g., `X-Powered-By: Express`) |
| `html` | Page HTML content (limited to 2MB) |
| `script` | Script source URLs |
| `stylesheet` | Stylesheet URLs |
| `cookie` | Cookie names |
| `meta` | Meta generator tag content |

### Design Decisions

- **No network requests** — detection runs against stored captures only
- **No language model** — all matching is deterministic regex evaluation
- **Time budget** — matching stops after 5 seconds to prevent runaway patterns
- **HTML byte limit** — only the first 2MB of HTML is examined
- **Stable order** — fingerprints are evaluated in declared order for deterministic results
- **Evidence required** — observed detections must have matched text; inferred detections must reference an implying detection
