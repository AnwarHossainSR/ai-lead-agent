# Design — Add Business Opportunity Analysis

## Context

`businessOpportunitySchema` already exists in `packages/database/src/schemas/evidence.ts` and was written with impact as prose specifically so no fabricated figure could be stored. `packages/config` already has a service catalogue with `resolveService` that throws on an unknown identifier rather than returning a default. `packages/ai` provides `AIService`, versioned prompts, validated-never-coerced output and the `ai_invocations` audit trail.

So the mechanisms are in place. This change is mostly about one question: how do you stop a language model, handed a list of website defects, from producing a confident paragraph about a company's expansion plans?

The answer this design takes is that a prompt instruction is a request, and only a post-parse check against the actual input is a rule.

## Goals / Non-Goals

**Goals:**

- Turn observed evidence into an opportunity an operator can open with.
- Make an unsupported claim structurally unable to reach the database.
- Keep "the evidence does not support anything" a first-class, recordable result.
- Make every stored opportunity traceable to its evidence and its model call.

**Non-Goals:**

- Scoring. The model produces no number of any kind.
- Any claim about revenue, headcount, funding, hiring or plans.
- Writing the outreach message.
- Analysing more than one company at a time.

## Decisions

### D1 — Citation identifiers are minted for the call, and checked after it

Every observation and detection put into the prompt is given a short, stable, call-local identifier (`o1`, `o2`, `t1` …). The output schema requires each opportunity to carry `citedEvidence: string[]`.

After parsing, and before anything is stored:

```ts
const supplied = new Set(inputEvidence.map((e) => e.ref));
for (const opportunity of parsed.opportunities) {
  if (opportunity.citedEvidence.length === 0) reject(opportunity, "no_citation");
  else if (opportunity.citedEvidence.some((ref) => !supplied.has(ref))) reject(opportunity, "unknown_citation");
}
```

**Why call-local identifiers rather than database UUIDs:** a model asked to echo a UUID gets a character wrong often enough to matter, and a near-miss UUID is indistinguishable from a fabricated one. Two-character references are cheap to reproduce exactly, and the mapping back to real identifiers is held by the caller. A reference that is not in the map is rejected either way — the shorter form just means fewer legitimate opportunities lost to transcription noise.

**Partial acceptance is deliberate.** A response with three good opportunities and one uncited one keeps the three and records the rejection. Discarding everything would push toward retrying, and retrying until the model stops citing badly is a way of selecting for output that passes the check rather than output that is true.

### D2 — Rejections are counted, not swallowed

Every rejection is recorded on the run with its reason (`no_citation`, `unknown_citation`, `unknown_service`, `blank_field`). A prompt version with a rising rejection rate is a prompt that needs work, and that is only visible if the rejections are data.

This is the same reasoning as the discovery run's rejected counts, and the same reasoning as `ai_invocations` recording attempts.

### D3 — The threshold check happens before the call, not after

A company with two observations and no detections cannot support an opportunity, and asking a model anyway produces one — because that is what it was asked to do. `MIN_EVIDENCE_FOR_ANALYSIS` (configuration) short-circuits before `AIService` is touched, recording `below_threshold`.

This saves money, but that is not the reason. The reason is that a thin-evidence call is where fabrication comes from.

### D4 — The output schema shapes what can be said

```ts
const opportunity = z.object({
  categoryId: z.string(),          // resolved against configured categories
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  impact: z.string().trim().min(1), // prose. no number field exists.
  citedEvidence: z.array(z.string()).min(1),
});

const output = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("opportunities"), opportunities: z.array(opportunity).min(1) }),
  z.object({ outcome: z.literal("insufficient_evidence"), reason: z.string().trim().min(1) }),
]);
```

There is no `estimatedValue`, no `potentialUplift`, no `confidence` number, no `priority`, no `timeline`. A field that does not exist cannot be filled with an invented figure — and a test asserts the schema's key set, so adding one is a deliberate act with a failing test attached.

`insufficient_evidence` is a *branch of the union*, not an empty array. An empty array reads as a successful run that found nothing; the union forces the model to say which it means.

### D5 — Category, not free text, mapped to a configured service

The model picks a `categoryId` from the configured taxonomy, and each category maps to a configured service. `resolveService` already throws on an unknown identifier, so an invented offering fails at the boundary rather than becoming a new product line by accident.

**Trade-off:** the model cannot describe an opportunity outside the taxonomy. That is the intent — the operator sells a fixed set of services, and an opportunity for something they do not sell is not a lead.

### D6 — Prompt construction, and the injection surface

The input contains scraped page text and company descriptions from third-party directories. Both are attacker-controlled in the ordinary case.

`packages/ai`'s `render` convention already keeps instructions and input in separate blocks with the input delimited. On top of that, this prompt's input is **structured, not prose**: observations arrive as `{ref, kind, detail, url}` records rather than a narrative, so there is less room for a sentence to read as an instruction.

And the real mitigation is downstream: even a fully successful injection can only produce opportunities, which must cite real evidence, name a configured service, and be approved by a human before anything is sent.

### D7 — Schema

```sql
opportunity_analysis_runs(
  id uuid pk,
  company_id uuid not null references companies on delete cascade,
  website_analysis_id uuid references website_analysis on delete set null,
  prompt_version integer not null,
  outcome opportunity_run_outcome not null,  -- opportunities|insufficient_evidence|below_threshold|failed
  accepted_count integer not null default 0,
  rejected_count integer not null default 0,
  rejections jsonb not null default '[]',    -- [{reason, count}]
  ai_invocation_id uuid references ai_invocations on delete restrict,
  reason text,
  created_at timestamptz not null default now(),
  check (outcome <> 'opportunities' or accepted_count > 0)
);

opportunities(
  id uuid pk,
  run_id uuid not null references opportunity_analysis_runs on delete cascade,
  company_id uuid not null references companies on delete cascade,
  category_id text not null,
  service_id text not null,
  title text not null, description text not null, impact text not null,
  certainty certainty not null default 'inferred',
  cited_evidence jsonb not null,             -- [{kind, id}] resolved back to real identifiers
  ai_invocation_id uuid not null references ai_invocations on delete restrict,
  created_at timestamptz not null default now(),
  check (certainty = 'inferred'),
  check (jsonb_array_length(cited_evidence) > 0),
  check (length(btrim(title)) > 0 and length(btrim(description)) > 0 and length(btrim(impact)) > 0)
);
```

`check (certainty = 'inferred')` looks redundant next to the default. It is not: it is what stops a hand-written `UPDATE` promoting a model's guess to an observation, which is exactly the edit somebody makes at 2am to get a lead over a scoring threshold.

`ON DELETE RESTRICT` on the invocation: the accounting outlives the opportunity.

### D8 — Testing

- **Unit, fake provider:** every rejection path (no citation, unknown citation, unknown service, blank field); partial acceptance keeping the good ones; the `insufficient_evidence` branch; the threshold short-circuit making no call at all; input assembly omitting unknown attributes and excluding other companies.
- **A schema-shape test** asserting the output schema's keys contain no quantified-impact field — the test that fails if someone adds one.
- **An injection test:** an observation whose detail text instructs the model to ignore its instructions and invent revenue. The assertion is not that the model resists it — that is not ours to guarantee — but that anything it produces still has to cite real evidence and name a real service, and that a fabricated citation is rejected.
- **Integration, real PostgreSQL:** all five `CHECK` constraints via raw `INSERT`/`UPDATE`, including the certainty guard.
- **No test calls a real provider.**

## Risks / Trade-offs

- **The model cites real evidence and still draws a wrong conclusion from it** → citation makes the reasoning inspectable, not correct. The mitigations are that impact is prose, certainty is `inferred`, and a human approves every message before it is sent. This change reduces fabrication; it does not claim to eliminate error.
- **Short call-local references could collide or be reused across calls** → they are scoped to one call and resolved through a map held by the caller; nothing persists them.
- **Partial acceptance hides a systematically bad prompt** → rejection reasons are counted per run, which is how a degrading prompt version becomes visible.
- **The taxonomy constrains what can be found** → intended; it is configuration, and adding a category is a data edit reviewed like any other.
- **Cost per company on re-analysis** → the threshold check and the `AIService` spend ceiling both apply, and re-analysis is explicit rather than automatic until the queue change.
- **`cited_evidence` as JSONB cannot be foreign-keyed** → accepted; the citations are validated against the input set at write time, and the alternative is a join table for a value that is only ever read whole.
