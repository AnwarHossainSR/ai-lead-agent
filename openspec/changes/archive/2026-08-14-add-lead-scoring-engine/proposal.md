# Add Lead Scoring Engine

**Roadmap coverage:** the `lead scoring` stage of the core pipeline, between decision maker research and the AI research summary.

## Why

`leads` exists with five per-component score columns, a unique `company_id`, `CHECK` constraints for total range, component range and a non-blank explanation, and `classifyPriority` in `packages/config` already maps a total to a priority band. Five scoring weights totalling 100 are configured and validated. Nothing produces a lead.

By this point a company has measured quality scores, evidenced technology detections, opportunities citing that evidence, and contacts with published sources. That is a lot of signal and no ordering. An operator working alone cannot look at four hundred companies; they can look at the top twenty. Scoring is what makes the difference between a database and a work queue.

The rule that governs the whole change is short: **scoring is a decision, so no part of it may call a model.** Including the explanation. An explanation written by a model is a narrative about a number rather than a derivation of it, and the moment those two can disagree, the explanation stops being evidence and becomes decoration.

## What Changes

**A scoring module in `apps/api`**

- Five component scorers, one per configured weight, each a pure function from a company's gathered evidence to a 0–100 sub-score plus the reasons that produced it.
- A composer applying the configured weights, deriving the total, and classifying the priority through the existing `classifyPriority`.
- A **deterministic explanation** assembled from the reasons each component returned — the actual inputs, their contribution, and what was missing. It is generated from the same values that produced the score, so it cannot contradict it.
- **Missing evidence lowers a component and is stated as missing.** It never becomes zero silently and never becomes an average.

**Rescoring is explicit and historical**

- A score is a snapshot of the evidence available when it ran. Rescoring writes a new snapshot, keeps the old one, and records what changed — so "why did this lead drop" is answerable.
- Changing a configured weight makes every existing score stale, and stale scores are queryable.

**API surface**

- Endpoints to score one company, score a batch, read a lead's score with its explanation and its history, and list leads by priority and score.

## Capabilities

### New Capabilities

- `lead-scoring`: Turning a company's gathered evidence into a weighted, explained, reproducible score and priority — computed entirely in deterministic code, stating what was missing rather than scoring it zero, and recorded as a snapshot that can be recomputed and compared over time.

### Modified Capabilities

- `lead-data-model`: adds score snapshots, the evidence set a score was computed from, and staleness tracking against the configured weight version.
- `product-configuration`: adds the per-component scoring rules and a weight version, and validates that every configured weight has a scorer.

## Impact

- New Nest module `apps/api/src/scoring/`.
- No new dependency — the whole change is arithmetic over data already stored.
- One new migration in `packages/database` adding score snapshots and staleness columns.
- Depends on `add-website-analysis`, `add-technology-detection`, `add-opportunity-analysis` and `add-decision-maker-research`.

## Non-goals

Deliberately deferred, or refused:

- **Any model involvement in the score or the explanation.** Refused. A score is a decision and an explanation is its derivation.
- **Machine-learned weights.** There is no outcome data yet; weights are configuration set by a human and reviewed in pull requests.
- **The AI research summary** — `add-research-summary` writes prose *about* a lead. It reads the score; it does not produce it.
- **Automatic rescoring on a schedule or on evidence change** — the staleness query is provided here; running it is `add-background-jobs`.
- **A scoring UI** — `add-dashboard`.
- **Predicting conversion probability.** Nothing in the data supports a probability, and a number presented as one would be invented.
