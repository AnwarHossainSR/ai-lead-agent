# Add Company Verification

**Roadmap coverage:** the `verification` stage of the core pipeline, between discovery and website analysis.

## Why

Discovery records what a source claimed. A directory listing can be five years stale, a places API can return a business that closed, and a name can be a franchise that no longer trades. `companies.verified` exists and defaults to false, and nothing has ever set it to true — which is correct, because nothing has ever checked.

Everything downstream is expensive: website analysis runs a browser and Lighthouse, opportunity analysis and research summaries cost money per call, and outreach costs the operator's reputation. Verification is the cheap filter that stops all of that being spent on a company that is not there. It is also the point at which the platform stops repeating a claim and starts holding an observation.

## What Changes

**A verification module in `apps/api`**

- A check interface: given a company, return a verdict, the evidence for it, and the URL at which that evidence can be inspected. A check that cannot produce evidence returns `unknown` — never a verdict.
- Four checks to start: **DNS resolution** of the claimed domain, **HTTP reachability** of the website, **domain-name correspondence** between the company name and the domain, and **registry presence** against a configured public business registry where one covers the country.
- A deterministic verdict rule combining check results into `verified`, `unverified` or `unreachable`. The rule is configuration, not a model.
- Re-verification with a configurable staleness window, so a company verified a year ago is not treated as verified today.

**Verification results are evidence, not a boolean**

- Every check run is persisted with its verdict, its evidence, its source URL and when it ran. `companies.verified` becomes the derived summary of those records rather than a flag anybody can set.

**API surface**

- Endpoints to verify one company, verify a batch, and read a company's verification history. Synchronous in this change; queued in `add-background-jobs`.

## Capabilities

### New Capabilities

- `company-verification`: Establishing whether a discovered company actually exists and is reachable, from checks that each produce inspectable evidence or explicitly return unknown, combined by a deterministic configured rule into a verdict that can be re-derived and re-checked as it goes stale.

### Modified Capabilities

- `lead-data-model`: adds `verification_checks` and the derived verification state on `companies`, and makes `verified` writable only through the verification path.
- `product-configuration`: adds the verification rule — which checks are required, which are sufficient, and the staleness window.

## Impact

- New Nest module `apps/api/src/verification/`.
- New dependency on a DNS resolver (Node built-in) and the existing HTTP client. No browser is used — that is website analysis.
- One new migration in `packages/database`, plus `verified_at` and `verification_state` on `companies`.
- `insertCompany` and `updateCompany` change so `verified` can no longer be supplied by a caller.

## Non-goals

Deliberately deferred:

- **Assessing the website's quality, performance or content** — `add-website-analysis`. Verification only asks whether it answers.
- **Detecting the technology behind the site** — `add-technology-detection`.
- **Any AI involvement.** A verdict is a decision, and decisions are deterministic code. No check calls a model.
- **Paid company-data enrichment providers** — the registry check uses public registries only. A commercial enrichment source can be added later as another check.
- **Confirming a company is a good prospect** — that is scoring. Verification establishes existence, nothing more.
- **Scheduled re-verification** — the staleness window is defined and queryable here; running it on a timer is `add-background-jobs`.
