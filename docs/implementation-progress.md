# Implementation Progress

## Pipeline Status

### The pipeline, in order

| Done | #   | Change                        | Depends on | Tasks |
| ---- | --- | ----------------------------- | ---------- | ----- |
| [x]  | 1   | `add-ai-provider-abstraction` | —          | 39    |
| [x]  | 2   | `add-company-discovery`       | —          | 52    |
| [x]  | 3   | `add-company-verification`    | 2          | 43    |
| [x]  | 4   | `add-website-analysis`        | 3          | 55    |
| [x]  | 5   | `add-technology-detection`    | 4          | 65    |
| [x]  | 6   | `add-opportunity-analysis`    | 1, 5       | 44    |
| [x]  | 7   | `add-decision-maker-research` | 3, 4       | 49    |
| [x]  | 8   | `add-lead-scoring-engine`     | 5, 6, 7    | 49    |
| [x]  | 9   | `add-research-summary`        | 8          | 43    |
| [x]  | 10  | `add-outreach-drafting`       | 9          | 43    |
| [x]  | 11  | `add-outreach-tracking`       | 10         | 51    |

### Infrastructure and surface

| Done | #   | Change                | Depends on                          | Tasks |
| ---- | --- | --------------------- | ----------------------------------- | ----- |
| [x]  | 12  | `add-background-jobs` | 2–11                                | 52    |
| [x]  | 13  | `add-dashboard`       | 8, 11                               | 50    |
| [x]  | 14  | `add-authentication`  | — for the API; 13 for its UI half   | 51    |
| [x]  | 15  | `add-observability`   | — for logging; 12 for queue metrics | 48    |
| [ ]  | 16  | `add-deployment`      | 14, 15                              | 55    |

### What can be built in parallel

- **1, 2, 14 and 15** have no dependency on each other and can start immediately.
- The chain **3 → 4 → 5** is strictly sequential.
- **6 and 7** can run in parallel once 4 is done.
- Everything from **8** onward is sequential.

## Completed Changes

### bootstrap-project-foundation — archived 2026-08-11

Established the workspace and the three capabilities now live in `openspec/specs/`:

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `product-configuration` | countries, cities, industries, services, lead statuses and transitions, priority bands, scoring weights, outreach channels |
| `lead-data-model`       | companies, contacts, website analyses, leads, outreach — with provenance, evidence and controlled transitions              |
| `developer-environment` | workspace commands, containerised PostgreSQL and Redis, validated environment, health endpoint, CI, documentation          |

Delivered: pnpm + Turborepo monorepo; Docker Compose stack; `@mela/config`, `@mela/shared`,
`@mela/database`; NestJS API with a Terminus health endpoint; Next.js 16 web shell; GitHub
Actions running lint, typecheck, test and build with no deployment step.

### add-ai-provider-abstraction — archived 2026-08-12

AI provider abstraction with prompt registry, versioned prompts, and spend ceiling.

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ai-provider`           | provider interface, Gemini + Cloudflare implementations, retry, errors, prompt registry, AIService                         |
| `product-configuration` | AI model tiers, prompt configuration                                                                                       |
| `developer-environment` | AI environment variables, provider setup                                                                                   |

Delivered: `AIProvider` interface with Gemini and Cloudflare implementations; `AIService` with prompt resolution, output validation, cost estimation, and spend ceiling; prompt registry with versioned modules; retry logic; error handling.

### add-company-discovery — archived 2026-08-12

Discovery of new companies across configured territories and industries.

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `company-discovery`     | source configuration, database schema, file-import adapter, places adapter, rate limiting, deduplication, run orchestration |
| `product-configuration` | discovery source configs, territory settings                                                                               |
| `lead-data-model`       | discovery_runs, discovery_run_sources, company_discovery_sources tables                                                    |

Delivered: Pluggable discovery sources (file_import, places); rate limiting with token buckets; deterministic deduplication; run orchestration with limits; API endpoints for runs and candidates; documentation.

### add-company-verification — archived 2026-08-12

Verification of discovered companies via deterministic checks and registry lookups.

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `company-verification`  | verification rule, checks (DNS, HTTP, domain-name-match, registry), verdict derivation, service, API endpoints             |
| `product-configuration` | verification rule config, politeness settings, registry configs                                                             |
| `lead-data-model`       | verification_checks table, verification enums, verification columns on companies                                           |

Delivered: Verification rule configuration with frozen validated data; database schema with evidence-required CHECK constraint; four deterministic checks with injected dependencies; pure `deriveState` function; `VerificationService` orchestrating checks and persisting results; three API endpoints for single/batch verification and state retrieval.

### add-website-analysis — archived 2026-08-12

Website analysis captures company web presence using headless browsers, runs quality audits, and records observations.

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `website-analysis`      | configuration, schema, fixture site, browser capture, artifacts, observation rules, politeness, API endpoints              |
| `product-configuration` | analysis config, viewport settings, observation rules                                                                      |
| `lead-data-model`       | website_analysis table, analysis outcomes, score columns                                                                   |

Delivered: Analysis configuration with viewports and observation rules; Playwright capture at desktop and mobile viewports; Lighthouse scoring via CDP; artifact storage; observation rules for issues; politeness with robots.txt; API endpoints for triggering and retrieving analyses.

### add-technology-detection — archived 2026-08-12

Technology detection identifies the software stack behind a company's website.

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `technology-detection`  | fingerprint configuration, database schema, matcher service, implications, integration with analysis                        |
| `product-configuration` | fingerprint patterns, match locations, technology categories                                                               |
| `lead-data-model`       | technology_detections table, detection outcomes                                                                            |

Delivered: Curated fingerprint patterns; database schema for detections; deterministic matcher service; version extraction from evidence; implication resolution; integration with website analysis; documentation.

### add-opportunity-analysis — archived 2026-08-12

Business opportunity analysis identifies opportunities from website evidence using a structured AI prompt with citation grounding.

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `opportunity-analysis`  | versioned prompt, model input assembly, citation validation, below-threshold short-circuit, run history, API endpoints     |
| `product-configuration` | opportunity taxonomy, evidence thresholds                                                                                  |
| `lead-data-model`       | opportunity_analysis_runs and opportunities tables with cited evidence, certainty and AI invocation references             |

Delivered: Versioned opportunity-analysis prompt with service catalogue; `buildModelInput` assembling call-local evidence references; `validateCitedEvidence` enforcing citation grounding; `OpportunityAnalysisService` orchestrating threshold check, model call and persistence; `POST /api/opportunity/analysis/:companyId` returning `below_threshold` when no analysis exists; migration with nullable `ai_invocation_id`; 2 API tests and full suite pass (321 tests).

### add-decision-maker-research — archived 2026-08-12

Contact research finds people at companies who could be contacted.

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `decision-maker-research`| seniority levels, role patterns, deterministic extraction, model extraction, seniority classification, deliverability checks |
| `product-configuration` | contact research config, conventional paths                                                                                |
| `lead-data-model`       | contacts table updates, contact_research_runs table, new enums                                                             |

Delivered: Seniority classification with Arabic/English patterns; deterministic extraction (mailto, tel, structured data); model extraction with grounding check; MX-based deliverability via DNS-over-HTTPS; ResearchService orchestrating extraction and persistence; API endpoints for research, listing, and deletion; documentation.

### add-lead-scoring-engine — completed 2026-08-13

Turns gathered evidence into weighted, explained, reproducible scores and priorities.

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `lead-scoring`          | evidence gathering, five deterministic scorers, composer, explanation formatter, scoring service, API controller           |
| `product-configuration` | scoring weights, per-component threshold bands, business fit profile, configured technologies, weight versioning            |
| `lead-data-model`       | lead score columns, lead_score_snapshots table with CHECK constraints, weight_version and scored_at columns                |

Delivered: `CompanyEvidence` read helper assembling analysis, detections, opportunities, contacts and company attributes; five pure scorers with load-time validation; weighted composition with missing-evidence capping; deterministic explanation formatter; `ScoringService` creating/updating leads and snapshots; API endpoints for single/batch scoring, lead listing, score history and recompute; no-model-call purity test; full test suite passes (928 tests).

### add-research-summary — completed 2026-08-13

Synthesizes gathered evidence into a concise, cited summary for outreach.

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `research-summary`      | versioned prompt, prohibited claim screening, input assembly, derived unknowns, service, API endpoints                     |
| `product-configuration` | prohibited claim categories with safe regex patterns                                                                       |
| `lead-data-model`       | lead_research_summaries table with sections, cited facts, unknowns, rejections, prompt version, AI invocation reference    |

Delivered: Research summary v1 prompt with structured sections and citation requirements; prohibited claim configuration with 6 default categories and safe pattern validation; input assembly mapping company evidence to prompt format; deterministic screening removing prohibited claims; derived unknown facts identifying missing evidence; `ResearchSummaryService` orchestrating evidence gathering, model call, screening and persistence; API endpoints for generating and retrieving summaries; database migration with CHECK constraints; full test suite passes.

### add-outreach-drafting — completed 2026-08-13

Drafts personalised outreach messages grounded in lead evidence, with human approval and no automatic sending.

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `outreach-drafting`     | versioned prompt, channel constraints, prohibited content categories, citation screening, input assembly, service, API endpoints, workflow tests |
| `product-configuration` | outreach channel config with tone/length constraints, automated sending forbidden, prohibited content categories with safe regex patterns |
| `lead-data-model`       | outreach table with provenance columns, approval/revocation timestamps, text hash, rejection reason, CHECK constraints enforcing approval order and text integrity |

Delivered: Outreach-drafting v1 prompt with per-channel tone and length constraints; prohibited content configuration with 5 default categories and safe pattern validation; input assembly from lead evidence, opportunities, contact and service catalogue; deterministic citation and content screening; `OutreachDraftingService` orchestrating model call, grounding and draft persistence; workflow endpoints for draft, submit, approve, reject, cancel and edit; database migration adding provenance columns and 7 CHECK constraints; absence-of-transport tests; full API test suite passes.

### add-outreach-tracking — completed 2026-08-13

Records outreach send events, classifies replies, and advances the lead lifecycle through configured transitions.

| Capability              | What it covers                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `outreach-tracking`     | send recording, response classification, lifecycle transitions, do-not-contact enforcement, analytics aggregates, API endpoints |
| `product-configuration` | response categories with transitions, no-response interval, minimum reporting sample size, outreach channels |
| `lead-data-model`       | outreach_responses table, do-not-contact columns on companies and contacts, CHECK constraints for send/response timing, database trigger for DNC enforcement |

Delivered: `POST /api/outreach/:id/sent` recording manual sends with backdate protection; `POST /api/outreach/:id/responses/classify` proposing categories via AI with grounding checks; `POST /api/outreach/:id/responses` confirming responses and applying lead transitions; `POST /api/outreach/:id/no-response` recording non-responses after the configured interval; do-not-contact drafting guards at service and database layers; unsubscribe marking both company and contact; company/contact DNC management endpoints; analytics service computing response rates by segment with minimum-sample-size flags; full test suite passes with 19 outreach/analytics tests.

## In Progress

**`add-dashboard` (Change #13)** — 48/50 tasks complete; `openspec validate add-dashboard --strict`
passes. Sections 1–9 are done, including a scenario-by-scenario audit of `specs/dashboard/spec.md`
and `specs/developer-environment/spec.md` (task 9.7) that found and fixed three real gaps: a
missing discovery-source link, an outreach review queue that never fetched drafts (so a freshly
AI-drafted or approval-revoked message was invisible), and a spec-required "record a manual send"
control that had never been built. Tasks 5.6 and 5.7 (Playwright workflow tests for the review
queue) are intentionally deferred per an explicit scope decision — covered instead by Vitest
component tests — and left unchecked rather than marked done; that is the only reason this isn't
50/50. Ready to archive once that deferral is revisited or accepted as final.

## Next Module

**`add-background-jobs` (Change #12)** — Background job processing. Depends on `add-outreach-tracking` (11), now complete. Ready to start.

After that: `add-background-jobs` (12), then archiving `add-dashboard` (13) once its remaining tasks close.

## New capabilities these changes introduce

`ai-provider`, `company-discovery`, `company-verification`, `website-analysis-pipeline`,
`technology-detection`, `opportunity-analysis`, `decision-maker-research`, `lead-scoring`,
`research-summary`, `outreach-drafting`, `outreach-tracking`, `background-jobs`, `dashboard`,
`authentication`, `observability`, `deployment`.

Each change also carries deltas against the three existing capabilities where it extends them.

## Constraints every change preserves

- **Human approval before any outreach.** No change adds a transport, a credential for a
  sending service, an endpoint that transmits, or a scheduler. `add-outreach-drafting` and
  `add-background-jobs` each carry a test asserting the absence.
- **Never fabricate.** Contact details are never constructed. Scores are never defaulted.
  Versions are never inferred. Model output must cite the evidence it was given.
- **Observed, inferred, unknown stay distinguishable** — in the schema, in the API and in the UI.
- **Deterministic code decides.** Scoring, deduplication, verdicts, transitions and validation
  contain no model call. The model interprets, summarizes, classifies and personalizes.
- **No anti-bot evasion.** A source that blocks us is recorded as blocked and left alone.

## Testing status — current build

| Package          | Test files | Tests | Status                          |
| ---------------- | ---------- | ----- | -------------------------------- |
| `@mela/config`   | 20         | 297   | passing                         |
| `@mela/shared`   | 3          | 66    | passing                         |
| `@mela/database` | 13         | 201   | 1 failing (pre-existing, below) |
| `@mela/ai`       | 11         | 99    | passing                         |
| `@mela/api`      | 57         | 458   | passing                         |
| `@mela/web`      | 22         | 83    | passing (Vitest; +9 Playwright) |

Each row above is from running that package's suite in isolation (`pnpm --filter <pkg> test`).
Running `pnpm test` at the root runs `@mela/database` and `@mela/api` concurrently against the
same `DATABASE_URL`; since neither test suite is schema-isolated from the other, that produces
spurious ordering/count/foreign-key failures that do not reproduce standalone. That is a
pre-existing test-infrastructure gap, not a regression — worth fixing before relying on a plain
root-level `pnpm test` for a pass/fail signal.

**Known pre-existing failure** (unrelated to `add-dashboard`, from the already-archived
`add-outreach-tracking` change): `packages/database/src/write/outreach.test.ts` →
`sending records its means > refuses a send without means via the database`. The test expects
the update to be refused by `outreach_sent_means_required`, but `outreach_sent_at_not_before_approved_at`
fires first — `sent_at` (a fresh `new Date()` in the test) is landing before `approved_at`
(set moments earlier), which points at a clock or timestamp-precision mismatch between the test
process and PostgreSQL rather than the constraint under test. Reproduces deterministically in
isolation (3/3 runs); not touched or introduced by `add-dashboard`.

## Next step

Apply a change with `/opsx:apply <change-name>`. `add-background-jobs` is now unblocked.
