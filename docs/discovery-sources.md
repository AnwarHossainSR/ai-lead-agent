# Discovery Sources

This document explains how discovery sources work, how to add a new one, and what happens when a source fails.

## Overview

Discovery sources are pluggable adapters that find candidate companies. Each source implements the `DiscoverySource` interface and returns `DiscoveredCandidate` objects.

## Available Sources

### file_import

- **Kind:** `file_import`
- **Status:** Enabled for UAE and Saudi Arabia
- **Description:** Reads a CSV or JSON list the operator already has
- **Crawl Permission:** Not applicable (no network requests)
- **Rate Limit:** 60 requests/minute (effectively unlimited)

This is the only source that contacts no third party. It is the zero-dependency way to seed a territory.

### places

- **Kind:** `places`
- **Status:** Disabled by default
- **Description:** Calls a licensed business listings API
- **Crawl Permission:** Not applicable (API calls, not website fetches)
- **Rate Limit:** 30 requests/minute

Requires `PLACES_API_KEY` and `PLACES_BASE_URL` environment variables. When the API key is absent, the source is disabled and a run refuses it by name rather than failing.

### business_directory

- **Kind:** `directory`
- **Status:** Declared but not enabled
- **Description:** Reads a public directory
- **Crawl Permission:** Denied by default
- **Rate Limit:** 30 requests/minute

Not yet implemented. When implemented, this will be the only source that fetches websites.

## Adding a New Source

1. **Add configuration** in `packages/config/src/product/discovery-sources.ts`:
   ```typescript
   {
     id: "my_source",
     name: "My Source",
     kind: "directory", // or "file_import" or "places"
     enabled: false,
     coveredCountries: ["uae"],
     maxRequestRatePerMinute: 30,
   }
   ```

2. **Implement the adapter** in `apps/api/src/discovery/sources/my-source.source.ts`:
   ```typescript
   import { type DiscoverySource, type DiscoverySourceResult } from "./source";

   export class MySource implements DiscoverySource {
     readonly sourceId = "my_source";

     async fetch(request: DiscoveryRequest): Promise<DiscoverySourceResult> {
       // Implementation here
     }
   }
   ```

3. **Add tests** with recorded fixtures (no live requests in tests)

4. **Enable in configuration** when ready for production use

## Crawl Permission

The `crawlAllowed` field controls whether a source may fetch websites:

- **`false` (default)** — the source is not contacted through a website fetch
- **`true`** — the source may fetch websites, respecting `robots.txt`

There is deliberately no field for:
- Ignoring `robots.txt`
- Bypassing bot checks
- Overriding crawl-delay
- User-agent rotation

A source that needs to fetch websites must be explicitly permitted by an operator.

## Rate Limiting

Each source has a `maxRequestRatePerMinute` configuration. The effective request interval is calculated as:

```
effectiveInterval = max(60000ms / maxRequestRatePerMinute, crawlDelay)
```

Where `crawlDelay` is the value from the source's `robots.txt` (if applicable).

## Block Detection

A source is marked as blocked when it returns:
- HTTP 403 (Forbidden)
- HTTP 429 (Too Many Requests) without a `Retry-After` header
- Bot challenge response signatures

When a source is blocked:
1. The run records the source outcome as "blocked" with a note
2. The source is not retried for the remainder of the run
3. Other sources continue normally

## What Happens on Failure

When a source fails (network error, invalid response, etc.):
1. The run records the source outcome as "failed" with a reason
2. The source is not retried for the remainder of the run
3. Other sources continue normally

The run outcome reflects the overall state:
- **`succeeded`** — all sources completed successfully
- **`partial`** — some sources failed/blocked, some succeeded
- **`failed`** — all sources failed or were blocked
- **`limit_reached`** — candidate or duration limit was hit
