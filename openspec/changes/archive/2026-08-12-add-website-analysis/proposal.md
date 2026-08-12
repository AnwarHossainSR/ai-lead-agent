# Add Website Analysis

**Roadmap coverage:** the `website analysis` stage of the core pipeline, between verification and technology detection.

## Why

`website_analysis` exists with nullable scores, three JSONB evidence columns and a `(company_id, created_at DESC)` index, and nothing writes to it. It is the table the whole product turns on: this is a tool for finding companies whose websites plausibly need modernization, and until something actually looks at a website there is no evidence to find them by.

The scores were deliberately made nullable with no default so that "not measured" is distinguishable from "scored zero". This change is where that decision earns its keep — a Lighthouse run that fails on a site that blocks headless browsers must leave the score null, because a stored zero would be read downstream as "this site is terrible", which is a fabricated finding about a real company.

## What Changes

**A website analysis module in `apps/api`**

- A **page capture** step using Playwright: load the site's home page at a desktop and a mobile viewport, record the final URL, HTTP status, console errors, request failures, page weight and load timings, and take a screenshot of each viewport.
- A **quality audit** step using Lighthouse against the same URL, producing performance, accessibility, best-practices and SEO scores.
- An **observation extraction** step deriving structured, evidence-carrying observations from what was captured — no HTTPS, no mobile viewport, blocking render, unhandled console errors, missing metadata — each recorded with what was seen and where.
- Everything bounded: navigation timeout, total run timeout, maximum page weight, one analysis in progress per company.

**Failure is recorded, not smoothed over**

- A capture that fails, a site that blocks automated browsers, and a Lighthouse run that errors each produce an analysis record with the scores left null and the reason stored. The record exists so the pipeline knows the site was tried; it claims nothing about quality.

**Artifacts on the local filesystem**

- Screenshots and the raw Lighthouse report are written under a configured directory, keyed by analysis id, with the record storing the relative path. Nothing binary goes into the database.

**API surface**

- Endpoints to analyse one company, read a company's latest analysis and its history. Synchronous in this change; queued in `add-background-jobs`.

## Capabilities

### New Capabilities

- `website-analysis-pipeline`: Loading a verified company's website in a real browser, auditing it, and turning what was actually observed into evidence-carrying findings — with unmeasured scores left unmeasured, failures recorded as failures, and every request bounded and polite.

### Modified Capabilities

- `lead-data-model`: adds analysis run state, capture artifacts and failure reasons to `website_analysis`; adds the constraint that a failed analysis carries no scores.
- `developer-environment`: adds the artifact directory and browser configuration, and the Playwright browser download step to setup and CI.

## Impact

- New Nest module `apps/api/src/website-analysis/`.
- New dependencies: `playwright` (already a devDependency in `apps/web` for E2E; here it is a runtime dependency of the API) and `lighthouse`.
- CI gains a browser installation step and a longer test job.
- One new migration adding columns to `website_analysis`.
- New environment variables for the artifact directory, navigation and run timeouts, and the maximum page weight.

## Non-goals

Deliberately deferred:

- **Identifying which technologies the site is built with** — `add-technology-detection` consumes what this change captures.
- **Interpreting what the findings mean commercially** — `add-opportunity-analysis`. This change observes; it does not conclude that a slow site means a sales opportunity.
- **Any AI involvement.** Everything here is measurement, and measurement is deterministic.
- **Crawling beyond the entry page and a small configured set of paths.** A full site crawl is a different cost profile and a different politeness problem.
- **Re-analysis on a schedule** — the staleness query is provided here; running it is `add-background-jobs`.
- **Object storage for artifacts** — local filesystem, as decided in the stack. Revisited at `add-deployment`.
