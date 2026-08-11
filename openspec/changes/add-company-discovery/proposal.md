# Add Company Discovery

**Roadmap coverage:** the `discovery` stage of the core pipeline — the first stage, and the one every later stage draws its input from.

## Why

`companies` exists and refuses a row without a discovery source and source URL, but nothing writes to it. Every later capability — verification, website analysis, technology detection, scoring, outreach — operates on companies that discovery produced. Until it exists the pipeline has no input, and the seed data is the only thing in the table.

Discovery is also where the "never fabricate" principle is easiest to violate and hardest to detect. A discovery service that returns a plausible company name and a guessed website looks exactly like one that found a real business, right up until someone sends an email to an address that never existed. So the design problem is not "how do we find companies" but "how do we make it structurally impossible to store one we did not actually find".

## What Changes

**A discovery module in `apps/api`**

- A source adapter interface: given a search request (country, city, industry), return candidates, each carrying the source it came from and the URL it was found at. An adapter that cannot supply a source URL cannot return a candidate.
- Two adapters to start: a **file import** adapter for lists a human already has, and a **places** adapter over a licensed business-listings API. Both are lawful sources with stable terms.
- A generic **directory** adapter usable only against sources explicitly configured as permitted, which reads `robots.txt`, honours crawl-delay, and refuses any source that disallows it. It contains no mechanism for defeating a bot check.
- A deterministic dedup and persistence step reusing `normalizeDomain` and `normalizeCompanyName`, so re-running discovery over the same territory adds nothing and updates provenance rather than creating a second record.

**Discovery runs are first-class**

- A run records what was searched, which sources were consulted, how many candidates each returned, how many were new, how many were duplicates, and how many were rejected — so a run that quietly found nothing is visible as such rather than looking like a success.

**Product configuration**

- Discovery sources become configured data: identifier, display name, kind, whether it is enabled, its rate limit, and whether it is permitted to be crawled.

**API surface**

- Endpoints to start a discovery run, list runs, and read a run's outcome. Synchronous and rate-limited in this change; moved onto a queue in `add-background-jobs`.

## Capabilities

### New Capabilities

- `company-discovery`: Finding candidate companies in a configured territory from configured lawful sources, recording where each came from, refusing any candidate without a traceable source, deduplicating against what is already known, and reporting each run's real outcome including what it rejected and why.

### Modified Capabilities

- `lead-data-model`: adds `discovery_runs` and `discovery_candidates`, and the run reference on `companies`.
- `product-configuration`: adds discovery source configuration and its validation.

## Impact

- New Nest module `apps/api/src/discovery/` with adapters, a dedup service and a run recorder.
- New dependency on an HTTP client and a `robots.txt` parser; the places adapter needs a licensed API key added to the environment schema.
- One new migration in `packages/database`, plus a nullable `discovery_run_id` on `companies`.
- No change to `apps/web` in this change.

## Non-goals

Deliberately deferred:

- **Verifying that a discovered company is real and trading** — that is `add-company-verification`. Discovery records what a source claimed; it does not confirm it.
- **Any website fetch of the company itself** — `add-website-analysis`.
- **LinkedIn as a source.** Its terms prohibit automated collection. The `linkedin_url` column is populated from sources that publish it, never by scraping LinkedIn.
- **Anything resembling anti-bot evasion** — no headless-browser fingerprint spoofing, no CAPTCHA solving, no proxy rotation to evade blocks. A source that blocks us is a source we do not use.
- **Running discovery on a schedule** — `add-background-jobs`.
- **A discovery UI** — `add-dashboard`. This change exposes the API only.
