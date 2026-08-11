# Design — Add Lead Scoring Engine

## Context

Most of this change's contract already exists. `leads` has five per-component score columns, a unique `company_id`, and three `CHECK` constraints: total in range, components in range, explanation non-blank. `insertLead` already derives the total as the component sum, derives the priority through `classifyPriority`, and forces the status to `INITIAL_LEAD_STATUS`. `applyLeadStatusChange` is the only path that moves a status. `packages/config` holds five weights validated to total 100, and priority bands validated to cover 0–100 with no gap or overlap.

What is missing is the thing that produces the five component values, and the honest explanation of how it got them.

The governing constraint is one line from the product principles: deterministic code for scoring. That includes the explanation. A model-written explanation is a story about a number, and the first time the story and the number disagree, the explanation stops being evidence.

## Goals / Non-Goals

**Goals:**

- Produce an ordering an operator can act on.
- Make every score reproducible from its recorded inputs.
- Make missing evidence visible as missing.
- Make a weight change visibly invalidate old scores.

**Non-Goals:**

- Any model call, including for the explanation.
- Learned weights or conversion prediction.
- Automatic rescoring.
- A UI.

## Decisions

### D1 — Five scorers, each a pure function returning value *and* reasons

```ts
interface ComponentResult {
  readonly value: number;             // 0..100
  readonly reasons: readonly Reason[]; // what drove it
  readonly missing: readonly string[]; // inputs that were absent
}
type Scorer = (evidence: CompanyEvidence, rules: ComponentRules) => ComponentResult;
```

The five components follow the configured weights:

| Component | Driven by |
|---|---|
| website quality | the four Lighthouse scores and the observation set from the latest completed analysis |
| technology fit | detections matched against configured technologies the operator sells against |
| opportunity strength | the count and category of accepted opportunities |
| contact reachability | contacts, their seniority rank, and their deliverability state |
| business fit | industry, country, city and company size against configured target profile |

**Returning `reasons` alongside `value` is the whole design.** It is what makes D3 possible without a second, independent narrative.

Every scorer is pure and total: same input, same output, no clock, no randomness, no I/O. That is what makes "recompute from the recorded evidence set" a test rather than an aspiration.

### D2 — Missing evidence is a third state, not a zero

A company with no website analysis and a company with a genuinely terrible website must not score the same. `ComponentResult.missing` names the absent inputs, and the composer:

- caps the component at the configured *unknown ceiling* for that component rather than assigning zero,
- records the absence in the snapshot,
- names it in the explanation.

**Why a cap rather than excluding the component and renormalising:** renormalising would let a company with almost no evidence score highly on the one thing that was measured, which inverts the intended ordering. A cap keeps the missing evidence costly without pretending it was measured badly.

**Total absence is refused, not scored.** A company with no analysis, no detections, no opportunities and no contacts produces no lead at all — a score of 12 on nothing is worse than no score, because it enters the work queue looking like a judgement.

### D3 — The explanation is assembled, not written

```
Total 74 (High).
  Website quality      62 × 0.30 = 18.6
    Performance 31/100, accessibility 58/100 (analysis 2026-08-04)
    No viewport meta tag; 6 console errors on load
  Technology fit       88 × 0.25 = 22.0
    WooCommerce (observed, x-powered-by), jQuery 1.12.4 (observed, script URL)
  Opportunity strength 70 × 0.20 = 14.0
    2 opportunities: storefront rebuild, performance remediation
  Contact reachability 55 × 0.15 =  8.3  [partial]
    1 contact, head level, domain receivable — no c-level contact found
  Business fit         73 × 0.10 =  7.3
    E-Commerce in Dubai matches target profile; company size unknown
```

Built by a formatter from the `ComponentResult`s. It cannot say a component was 62 when the stored column says 58, because it reads the same value. Rendering is a pure function and is snapshot-tested.

**Trade-off:** less fluent than model-written prose. That is the correct trade for a field an operator uses to decide whether to contact a real business.

### D4 — Snapshots, and what "the evidence it was computed from" means

```sql
lead_score_snapshots(
  id uuid pk,
  lead_id uuid not null references leads on delete cascade,
  company_id uuid not null references companies on delete cascade,
  website_quality_score integer not null, technology_fit_score integer not null,
  opportunity_score integer not null, contact_score integer not null,
  business_fit_score integer not null,
  total_score integer not null, priority lead_priority not null,
  explanation text not null,
  weight_version integer not null,
  evidence_refs jsonb not null,     -- {analysisId, detectionIds, opportunityIds, contactIds}
  missing jsonb not null default '[]',
  created_at timestamptz not null default now(),
  check (length(btrim(explanation)) > 0),
  check (total_score between 0 and 100)
);
create index on lead_score_snapshots (lead_id, created_at desc);

-- leads gains:
weight_version integer not null,
scored_at timestamptz not null,
create index on leads (weight_version);
```

`evidence_refs` records *identifiers*, not copies. Recomputation reads those rows and re-scores; if an opportunity has since been deleted, recomputation says so rather than silently producing a different number. That is more useful than a frozen copy, which would let a snapshot claim evidence that no longer exists.

The "total equals weighted components" rule is enforced as a generated-column comparison in the `CHECK` rather than by trusting the writer, matching how the existing lead constraints work.

### D5 — Weight version, and a fingerprint that forces it to be incremented

A version nobody remembers to increment is worse than no version. So configuration stores both `weightVersion` and a fingerprint of the weight values, and load-time validation fails if the values do not match the fingerprint recorded for that version.

Changing a weight therefore fails startup until the version is incremented and the fingerprint updated — which is a two-line diff in the same file, visible in review, and impossible to forget.

`listStaleLeads()` returns leads whose `weight_version` is below the current one. Rescoring them is `add-background-jobs`.

### D6 — Scoring never touches status

`updateLeadScore` writes only the score columns, the weight version and `scored_at`. It has no status parameter, following the same pattern as `insertOutreachDraft` having no approval parameter. `applyLeadStatusChange` remains the only status writer.

**Why this matters:** rescoring a lead an operator has already contacted must not silently return it to `new`. That would be a data-loss bug disguised as a refresh.

### D7 — Testing

- **Unit, no database:** each scorer against evidence fixtures, including all-missing, partially-missing and complete; the unknown-ceiling behaviour; the composer's weighted arithmetic; the explanation formatter as a snapshot test; the priority boundary values 90/89/80/79/70/69 that `packages/config` tests already cover, re-asserted end to end.
- **A determinism test** scoring identical evidence twice and asserting byte-identical explanations.
- **A recomputation test** storing a snapshot, re-scoring from its `evidence_refs`, and asserting equality — the spec scenario, and the thing that catches a scorer that accidentally reads the clock.
- **Integration, real PostgreSQL:** the snapshot consistency `CHECK` via raw `INSERT`; the second-lead refusal; a scoring write attempting a status change; the stale-by-version query using its index.
- **A test asserting no model call** anywhere in the module.

## Risks / Trade-offs

- **Weights set by intuition rather than outcome data** → acknowledged; there is no outcome data yet. They are configuration, versioned, and every score records which version produced it, so a future recalibration has the history to work from.
- **The unknown ceiling is itself a judgement** → it is configuration per component, validated and tested, rather than a constant buried in a scorer.
- **A formatted explanation is less readable than prose** → deliberate; `add-research-summary` produces prose *about* a lead for a human to read, clearly marked as AI-generated, and it reads the score rather than producing it.
- **`evidence_refs` can dangle when evidence is deleted** → recomputation reports the missing evidence instead of silently scoring differently, which is the honest behaviour.
- **Rescoring a large portfolio after a weight change is expensive** → it is pure arithmetic over stored rows, no network and no model; the queue change adds batching.
- **Five components may not be the right five** → adding one is a configured weight plus a scorer plus a version increment, and load-time validation refuses to let those drift apart.
