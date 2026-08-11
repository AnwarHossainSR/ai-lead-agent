# Add Technology Detection

**Roadmap coverage:** the `technology detection` stage of the core pipeline, between website analysis and business opportunity analysis.

## Why

`website_analysis` has a `technologies` JSONB column validated by `technologyEvidenceSchema`, which already requires evidence and permits a version only when one is actually known. Nothing populates it.

Knowing what a site is built on is the difference between a generic pitch and a specific one. "Your site is slow" is worth nothing; "your WooCommerce storefront is on PHP 7.4 with jQuery 1.x and no CDN" is a conversation. It is also the signal that maps most directly onto what this operator sells — a WordPress site with three page builders is a rebuild, a bare React SPA with no server rendering is an SEO problem, an origin serving from a single region is a cloud modernization job.

The failure mode is obvious and severe. Technology detection is pattern matching, and pattern matching produces false positives that read as facts. A stored claim that a company uses a technology it does not use, surfaced in an outreach email, is exactly the fabrication the product principles forbid — and it is the kind that gets noticed by the recipient.

## What Changes

**A detection module in `apps/api`**

- Fingerprints declared as **validated configuration data**: a technology identifier, its category, and the patterns that indicate it — response headers, HTML markup, script and stylesheet URLs, cookie names, `meta generator` content, and global JavaScript variables observed in the page.
- A deterministic matcher run over the `PageCapture` that website analysis already produces. It re-uses the stored capture; it does not fetch anything itself.
- **Every detection carries the fingerprint that matched and the exact text that matched it.** A detection whose evidence cannot be reproduced from the capture is discarded.
- **Versions are read, never inferred.** A version is recorded only when it appears verbatim in the evidence; otherwise the technology is recorded with no version.
- Implication rules: detecting a technology may imply others it always ships with (WooCommerce implies WordPress implies PHP). Implied detections are recorded with a certainty of inferred and a reference to the detection that implied them, so an implication is never mistaken for an observation.

**Data model**

- Detections become their own rows rather than an opaque JSONB blob, so they can be queried, counted across the portfolio, and superseded when a company is re-analysed.

## Capabilities

### New Capabilities

- `technology-detection`: Identifying the technologies behind a company's website from patterns matched against what was actually captured, recording the matching evidence for every claim, reading versions only where they are stated, and marking anything merely implied as inferred rather than observed.

### Modified Capabilities

- `lead-data-model`: adds a detections table keyed to an analysis, with the fingerprint identifier, matched evidence, certainty and optional version.
- `product-configuration`: adds fingerprint and category configuration with load-time validation.

## Impact

- New Nest module `apps/api/src/technology-detection/`.
- No new runtime dependency — the matcher is regular expressions over data the previous change already captures. Fingerprint definitions are authored in the repository rather than pulled from a third-party dataset at runtime.
- One new migration in `packages/database`.
- `website_analysis.technologies` remains as the denormalized summary the analysis record carries; the new table is the queryable record.

## Non-goals

Deliberately deferred:

- **Fetching anything.** Detection runs against the capture the analysis already stored. If it needs a signal the capture does not contain, the fix is in the capture step, not a second request.
- **Deciding whether a technology represents an opportunity** — `add-opportunity-analysis`. Detecting WordPress is not the same as concluding that a rebuild is warranted.
- **Any AI involvement.** Pattern matching over evidence is deterministic, and a model asked "what is this site built with" will confidently produce a plausible list. That is precisely the fabrication this change exists to prevent.
- **Importing a third-party fingerprint dataset wholesale.** A curated set covering what this operator actually sells against beats thousands of rules nobody has read, and a runtime dependency on an external dataset is a supply-chain surface for very little gain.
- **Detecting server-side technology not visible from the client** — inferring a database or a cloud provider from the outside is guesswork, and guesswork does not get stored.
