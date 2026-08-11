# Design — Add Website Analysis

## Context

`website_analysis` already has the shape this change needs: nullable scores with per-column `0..100` `CHECK` constraints that only apply when non-null, three JSONB columns validated by the evidence schemas in `packages/database/src/schemas/evidence.ts`, and a `(company_id, created_at DESC)` index. `getLatestWebsiteAnalysis` already orders by `createdAt DESC, id DESC` so ties resolve deterministically.

Playwright is already a devDependency of `apps/web` for the E2E smoke test. Here it becomes a runtime dependency of `apps/api`, which is a meaningful change: the API process now needs a browser binary present, and CI needs to install one.

The governing constraint is the one the nullable scores were designed for. A site that blocks headless browsers is extremely common, and the tempting behaviour — record a zero, or fall back to a cheap heuristic score — would write a fabricated judgement about a real business into a table that later feeds a sales email.

## Goals / Non-Goals

**Goals:**

- Observe a real site with a real browser and record what was actually seen.
- Keep unmeasured unmeasured, and make failure a first-class outcome.
- Never let a hostile or broken site hang, leak a browser process, or fill a disk.
- Stay polite and unmistakably identifiable.

**Non-Goals:**

- Identifying frameworks, CMSes or hosting — the next change.
- Deciding what any finding means commercially — the change after that.
- Any model call.
- A full-site crawl.

## Decisions

### D1 — Two steps, separately failable: capture, then audit

**Capture** (Playwright) and **audit** (Lighthouse) are separate operations against the same URL, and either can fail without the other. That is why `partial` is one of the five outcomes: a site that loads fine but crashes Lighthouse should still yield the console errors, the mixed-content finding and the screenshot, with the scores left null.

Running Lighthouse *through* the same Playwright browser (attaching over CDP) rather than letting it launch its own Chrome means one browser lifecycle to manage, one place to enforce the timeout, and one user agent to keep honest.

```
apps/api/src/website-analysis/
├─ website-analysis.module.ts
├─ website-analysis.controller.ts
├─ analysis.service.ts          orchestrates, owns the run timeout
├─ capture/
│  ├─ browser.ts                pooled browser, per-analysis context
│  ├─ page-capture.ts           desktop + mobile viewport
│  └─ artifacts.ts              path building, containment, writes
├─ audit/
│  └─ lighthouse.ts             attaches over CDP, maps categories to scores
├─ observations/
│  ├─ rules.ts                  deterministic rules over captured facts
│  └─ rules/*.ts                one file per rule
└─ testing/
   └─ fixture-site/             the sites every test runs against
```

### D2 — One browser, one context per analysis, always closed

A single Playwright `Browser` is launched lazily and reused; each analysis gets a fresh `BrowserContext` disposed in a `finally`. Launching a browser per analysis costs about a second each time; sharing a context leaks cookies and storage between unrelated companies.

The context is created with `ignoreHTTPSErrors: false` on purpose — a site with a broken certificate is a *finding*, and swallowing the error would hide it.

**Process hygiene:** the module implements `onApplicationShutdown` to close the browser, the same way the database and Redis modules close theirs. A leaked Chromium is the failure mode that makes a developer's machine unusable, and it is invisible until it is not.

### D3 — Two viewports, one entry page, a small configured path set

Desktop 1440×900 and mobile 390×844. The mobile pass exists because "is this site usable on a phone" is one of the strongest signals for this product's actual sales pitch, and Lighthouse's mobile emulation alone does not capture layout overflow.

Beyond the entry page, a configured list of paths is tried (`/about`, `/contact`, `/services`), each optional and each a separate rate-limited request. A 404 is recorded as an observation, not a failure — most sites will not have all of them.

**Not a crawler.** No link following, no queue of discovered URLs. A crawler is a different politeness problem and a different cost profile, and nothing downstream needs one.

### D4 — Observations are deterministic rules over captured facts

Capture produces a plain, serialisable `PageCapture` record: final URL, status, redirect chain, timings, transfer size, console messages, failed requests, response headers, and the rendered HTML. Rules are pure functions from `PageCapture` to `Observation[]`.

Initial rules: no HTTPS, invalid certificate, no viewport meta tag, render-blocking resources above a threshold, console errors present, failed requests present, missing `<title>` or meta description, no favicon, mixed content, page weight above a threshold.

Each rule returns evidence naming what it saw — `"3 console errors on load, first: <text>"` — not a verdict. Whether any of it constitutes a business problem is a later change's job, and keeping the boundary sharp is what stops "slow site" quietly becoming "needs a rebuild" with nobody having decided it.

**Pure functions, so every rule is a unit test with no browser.**

### D5 — Artifacts on the filesystem, paths contained

`ANALYSIS_ARTIFACT_ROOT` (default `./.artifacts`, git-ignored). Layout: `<root>/<company-id>/<analysis-id>/{desktop.png,mobile.png,lighthouse.json}`. The database stores the path *relative to the root*.

`artifacts.ts` resolves every path and asserts it stays within the root before writing, and the write helper rejects an absolute path or one containing `..`. This is guarding against our own bug rather than an attacker — company ids are UUIDs — but a path-building mistake that writes outside a configured directory is worth one `startsWith` check.

**Not object storage.** The stack says local filesystem for files. `add-deployment` revisits it.

### D6 — Bounds, and what each one protects

| Bound | Default | Protects against |
|---|---|---|
| `ANALYSIS_NAVIGATION_TIMEOUT_MS` | 30000 | a page that never fires its load event |
| `ANALYSIS_RUN_TIMEOUT_MS` | 120000 | the whole analysis, Lighthouse included, wedging |
| `ANALYSIS_MAX_PAGE_BYTES` | 25 MB | a site that streams indefinitely |
| per-host interval (shared with verification) | 2 s | hammering one host |
| one in-progress analysis per company | — | duplicate concurrent work |

The in-progress limit is a partial unique index on `website_analysis (company_id) WHERE outcome = 'in_progress'`, the same mechanism discovery uses for runs. The service catches the unique violation and raises a named error, following the `DuplicateCompanyError` precedent.

### D7 — Schema additions to `website_analysis`

```sql
outcome website_analysis_outcome not null default 'in_progress',
  -- in_progress | completed | partial | blocked | skipped | failed
failure_reason text,
analyzed_url text,               -- final URL after redirects
http_status integer,
desktop_screenshot_path text,
mobile_screenshot_path text,
audit_report_path text,
ran_against_unverified boolean not null default false,

check (outcome not in ('blocked','skipped','failed') or failure_reason is not null),
check (outcome not in ('blocked','skipped','failed')
       or (performance_score is null and accessibility_score is null
           and best_practices_score is null and seo_score is null))
```

The second `CHECK` is the "never fabricate" rule made structural: a hand-written `UPDATE` cannot attach a score to a failed analysis either.

### D8 — Politeness, and the deliberate absence of an escape hatch

The `robots.txt` evaluator and per-host limiter extracted in `add-company-verification` are reused unchanged. The user agent is a fixed string naming the tool and a contact URL, set once in `browser.ts` and asserted by a test to be constant.

**There is no configuration field for a proxy, a user-agent list, a stealth plugin, or a challenge solver, and a test asserts the module's configuration schema contains none.** Chromium's default automation fingerprint is left exactly as it is. A site that blocks us is recorded as `blocked` and left alone.

### D9 — Testing without the internet

A **local fixture site** served by the test process provides: a good site, a site with no HTTPS, a site with console errors, a site that never finishes loading, a site that returns 403 with a challenge body, an oversized response, and a `robots.txt` that disallows a path. Every scenario in the spec maps to one of these.

- **Unit, no browser:** every observation rule against `PageCapture` fixtures; artifact path containment; the score-nullability guard.
- **Integration, real browser and real PostgreSQL:** the outcomes, the `CHECK` constraints via raw `UPDATE`, the in-progress index, browser cleanup after a crash.
- **No test loads a real external site.** Real sites change, go down, and would make the suite fail for reasons unrelated to the code.

CI installs the pinned Chromium via `playwright install --with-deps chromium` before the API test job.

## Risks / Trade-offs

- **CI gets slower and heavier** → the browser-backed tests are tagged and run in the API job only; the pinned browser is cached by version key.
- **Lighthouse is a large dependency with its own Chrome expectations** → it is attached to the Playwright browser over CDP rather than launching its own, and its version is pinned alongside the browser.
- **Blocked sites may be a large fraction of real targets** → recorded honestly as `blocked` and countable, which makes the size of the problem visible rather than hidden inside a low average score. If it turns out to be most sites, the answer is a product decision, not a stealth plugin.
- **Screenshots accumulate on disk** → artifacts are keyed by analysis id and a retention task is listed in `add-background-jobs`; until then, growth is bounded by how many analyses a single operator runs.
- **A shared browser means one crash affects a concurrent analysis** → concurrency in this change is one analysis at a time per process; the queue change introduces real parallelism and revisits pooling with that constraint known.
- **The rendered HTML is stored in the capture record and can be large** → it is passed to the observation rules and to the next change's technology detection, but only artifact *paths* and derived observations are persisted; the HTML itself is written to disk with the other artifacts.
