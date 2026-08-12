# Add Business Opportunity Analysis

**Roadmap coverage:** the `business opportunity analysis` stage of the core pipeline, between technology detection and decision maker research.

## Why

By this point a company has observations from a real browser run and technology detections with the text that matched them. All of it is factual and none of it is a sales case. "Six console errors, no viewport meta tag, WooCommerce, jQuery 1.12" is a measurement; "this storefront is unusable on a phone, which is where their customers are" is the thing an operator can open a conversation with.

Turning the first into the second is interpretation, and interpretation is the one job the product principles assign to a language model. It is also the single most dangerous place in the pipeline: a model given a list of findings will happily produce a confident narrative about a company's growth plans, hiring, revenue and strategy — none of which it was given and none of which is true. Everything in this change is arranged so that cannot survive to the database.

## What Changes

**An opportunity analysis module in `apps/api`**

- A versioned prompt in `packages/ai` that receives **only** the observed evidence for one company — analysis observations, technology detections with their matched text, the company's industry and country — and the operator's configured service catalogue.
- Output constrained to a schema where every opportunity **must cite the evidence identifiers it rests on**. An opportunity citing nothing, or citing an identifier not in the input, is rejected before it reaches the database.
- An explicit `insufficient_evidence` outcome the model is instructed to use, recorded as a real result rather than an empty list that looks like a clean run.
- Impact expressed as prose, never a number. `businessOpportunitySchema` already forbids a fabricated figure and this change does not add one.
- Every opportunity mapped to one of the operator's configured services, refusing an unknown service identifier rather than inventing an offering.

**Grounding is enforced in code, not asked for in the prompt**

- The citation check runs against the actual input set. A prompt instruction is a request; a post-parse rejection is a rule.

**Data model**

- Opportunities become their own rows carrying their certainty, their service, their cited evidence and the AI invocation that produced them — so any claim in a future outreach email can be traced to the model call and from there to the observation it rests on.

## Capabilities

### New Capabilities

- `opportunity-analysis`: Interpreting a company's observed website evidence into business opportunities matched to the operator's services, where every opportunity must cite the evidence it rests on, unsupported claims are rejected rather than stored, impact is described rather than quantified, and "not enough evidence" is a recordable result.

### Modified Capabilities

- `lead-data-model`: adds an opportunities table with cited evidence, service reference, certainty and AI invocation reference.
- `product-configuration`: adds the opportunity taxonomy and the evidence thresholds under which analysis is not attempted at all.

## Impact

- New Nest module `apps/api/src/opportunity-analysis/`.
- New prompt in `packages/ai` with its output schema; first production consumer of `AIService`.
- One new migration in `packages/database`.
- Depends on `add-ai-provider-abstraction`, `add-website-analysis` and `add-technology-detection`.

## Non-goals

Deliberately deferred:

- **Scoring the lead** — `add-lead-scoring-engine`. Opportunities are inputs to a score; they are not a score, and the model does not produce one.
- **Writing the outreach message** — `add-outreach-drafting`.
- **Researching people** — `add-decision-maker-research`.
- **Estimating revenue, budget, deal size or timeline.** The model is not given the information and cannot obtain it. Any number here would be invented.
- **Claims about a company's plans, hiring, funding or strategy.** Nothing in the input supports them, and the output schema has no field to put them in.
- **Multi-company or market-level analysis** — one company at a time, from that company's own evidence.
