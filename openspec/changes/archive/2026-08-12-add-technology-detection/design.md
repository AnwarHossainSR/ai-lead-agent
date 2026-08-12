# Design — Add Technology Detection

## Context

`add-website-analysis` produces a serialisable `PageCapture` — final URL, status, redirect chain, response headers, console messages, failed requests, and rendered HTML written to disk with the other artifacts. `website_analysis.technologies` is a JSONB column already validated by `technologyEvidenceSchema`, which requires evidence and makes `version` optional. `packages/config` validates its data at module load and refuses unknown identifiers by name.

So everything this change needs already exists. What it adds is the matcher, the fingerprint data, and a queryable table.

The constraint that shapes it: a false positive here is indistinguishable from a fabrication once it reaches an outreach email. "I noticed you're on Shopify" to a company that is not on Shopify ends the conversation and damages the sender. So every claim must carry the text that produced it, and anything not directly matched must be visibly marked as inferred.

## Goals / Non-Goals

**Goals:**

- Detect what the site is actually built with, with evidence attached to every claim.
- Make "we inferred this" impossible to confuse with "we saw this".
- Keep versions honest — read or absent, never estimated.
- Make adding a fingerprint a data edit.

**Non-Goals:**

- Fetching anything.
- Concluding that a technology represents a sales opportunity.
- Any model call.
- Comprehensive coverage of every technology in existence.

## Decisions

### D1 — Fingerprints are curated configuration, not an imported dataset

**Choice:** fingerprints live in `packages/config` as validated data, authored in this repository.

**Why:** a runtime dependency on a third-party fingerprint dataset means an unreviewed rule can start producing claims about real companies after a routine dependency bump. Curating perhaps eighty fingerprints covering what this operator actually sells against — CMSes, e-commerce platforms, front-end frameworks, page builders, analytics, CDNs, payment providers, hosting — beats thousands nobody has read.

**Trade-off:** lower coverage. Accepted: an undetected technology yields nothing, which is the safe failure. A wrong one yields a claim.

```ts
{
  id: "woocommerce",
  technology: "WooCommerce",
  category: "ecommerce",
  patterns: [
    { in: "html",    match: /woocommerce[-.]?(?:[\d.]+)?/i, version: 1 },
    { in: "script",  match: /\/plugins\/woocommerce\// },
    { in: "cookie",  match: /^woocommerce_/ },
  ],
  implies: ["wordpress"],
}
```

`version: 1` names the capture group to read a version from. Absent means this pattern can never produce a version — which is most of them.

### D2 — Six match locations, each derived from the capture

| `in` | Source | Note |
|---|---|---|
| `header` | response headers | `x-powered-by`, `server`, `x-shopify-stage` |
| `html` | rendered HTML | strongest and noisiest |
| `script` | `src` of every script element and every requested script URL | catches CDN-hosted libraries |
| `stylesheet` | `href` of every stylesheet | page builders leak here |
| `cookie` | cookie names set on the response | session cookie names are strong signals |
| `meta` | `<meta name="generator">` content | authoritative when present |

`global` (window variables) is deliberately **not** included. Reading globals needs an in-page evaluation at capture time, which is a change to the previous step, and the signal it adds is largely covered by `script`. Listed here so the omission is a decision rather than an oversight.

### D3 — Two certainties, matching what the database already permits

The `certainty` enum in `packages/database` has exactly two values, `observed` and `inferred`, and deliberately no third for a guess. This change uses both and adds nothing:

- **observed** — a declared pattern matched captured content; the matched text is stored.
- **inferred** — implied by an observed detection; the implying detection's id is stored.

An implied technology can be *upgraded* to observed if its own pattern also matches, never downgraded. A `CHECK` enforces that observed requires matched text and inferred requires an implying reference, so a hand-written `INSERT` meets the same rule.

**Implication depth is unbounded but acyclic** — WooCommerce → WordPress → PHP is three levels and legitimate. Cycles fail at configuration load, computed with a depth-first search over the implication graph the same way the lead status transition map is validated.

### D4 — Versions: read from a capture group or absent

The only way a version is recorded is a pattern declaring a `version` capture group that matched. There is no version inference table, no "this feature implies ≥ 4.2", no release-date lookup.

**Why this is worth being strict about:** a version is the most specific claim in an outreach email and the easiest to get wrong. `technologyEvidenceSchema` already makes it optional; this keeps it honest.

### D5 — Matching is bounded, and patterns are screened at load

Rendered HTML from an arbitrary site is attacker-influenced input, and a regular expression with nested unbounded repetition against a crafted page is a denial of service against our own worker.

- **At load:** every pattern is screened for nested quantifiers over an unbounded group; a failing pattern fails configuration load, naming the fingerprint. This is the same "fail at load, not at request time" rule the rest of `packages/config` follows.
- **At runtime:** total matching time per capture is bounded (`DETECTION_TIME_BUDGET_MS`, default 5000). Exceeding it ends matching, retains the detections found so far, and records the reason. Fingerprints are evaluated in a stable declared order so a partial result is at least deterministic.

Matching also runs against a bounded prefix of the HTML (`DETECTION_MAX_HTML_BYTES`, default 2 MB) rather than an arbitrarily large document.

### D6 — Schema

```sql
technology_detections(
  id uuid pk,
  analysis_id uuid not null references website_analysis on delete cascade,
  company_id uuid not null references companies on delete cascade,
  fingerprint_id text not null,
  technology_id text not null,
  category text not null,
  certainty certainty not null,               -- reuses the existing enum
  matched_in text,                            -- header | html | script | stylesheet | cookie | meta
  matched_text text,
  version text,
  implied_by uuid references technology_detections on delete cascade,
  created_at timestamptz not null default now(),

  unique (analysis_id, technology_id),
  check (certainty <> 'observed' or (matched_in is not null and matched_text is not null)),
  check (certainty <> 'inferred' or implied_by is not null)
);
create index on technology_detections (technology_id);
create index on technology_detections (company_id, created_at desc);
```

`company_id` is denormalized alongside `analysis_id` so "how many companies use WooCommerce" is one join rather than two. It is derived on write from the analysis, never accepted from the caller — the same rule the normalization keys follow.

`website_analysis.technologies` is still written, as the denormalized summary the analysis record carries. The table is the queryable record; the column is what a single analysis read returns without a join.

### D7 — Detection runs as a step of analysis, and can be re-run alone

The analysis service calls detection immediately after a completed capture, in the same transaction as writing the analysis. A separate `POST /api/analysis/:id/detect` re-runs it against a stored capture — which is how a newly added fingerprint gets applied to existing analyses without re-fetching a single site.

**That endpoint is the reason the capture is written to disk rather than discarded.** Re-running the matcher over stored captures after adding fingerprints is free; re-crawling is neither free nor polite.

### D8 — Testing

- **Unit, no database:** the matcher against `PageCapture` fixtures for each location; version extraction present and absent; implication resolution including chains; upgrade from inferred to observed; the load-time screens for duplicates, invalid patterns, unknown categories and cycles; the time budget ending matching with a partial result.
- **Integration, real PostgreSQL:** the two `CHECK` constraints via raw `INSERT`; the per-analysis uniqueness; cascade deletes; the cross-company count query using its index.
- **A determinism test** runs the matcher twice over one fixture and asserts identical output, which is the spec scenario and also catches accidental `Set` or object-key ordering dependence.
- **A test asserts no model call** occurs anywhere in the module.

## Risks / Trade-offs

- **Curated fingerprints go stale as platforms change their markers** → a fingerprint that stops matching produces nothing rather than something wrong, and portfolio-level counts make a marker that suddenly disappeared visible. Re-running detection over stored captures makes correcting it cheap.
- **False positives from a broad HTML pattern** → every detection stores its matched text, so a bad fingerprint is diagnosable from the data rather than by re-fetching; and the outreach change requires a human to approve anything before it is sent.
- **Implications overstate the stack** → they are a distinct certainty, stored with the detection that caused them, and downstream consumers can ignore inferred detections entirely.
- **Denormalized `company_id` can disagree with the analysis** → derived on write, never supplied, with a test asserting a caller cannot set it.
- **Client-side detection cannot see server-side technology** → stated as a non-goal rather than papered over with inference; a company's database and cloud provider stay unknown unless a header says otherwise.
