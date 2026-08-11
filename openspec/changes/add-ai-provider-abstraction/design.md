# Design — Add AI Provider Abstraction

## Context

The repository currently has no AI dependency at all. `packages/config`, `packages/shared`, `packages/database`, `apps/api` and `apps/web` exist; the five core tables are migrated; `apps/api` is a NestJS 11 application with a Terminus health endpoint and a global Zod validation pipe.

Three constraints shape everything below:

1. **Never fabricate.** A model that does not know something must be able to say so, and that answer must survive to the database as `unknown` rather than being replaced by a plausible guess.
2. **Observed vs inferred vs unknown.** The data model already carries a `certainty` enum with exactly two values, `observed` and `inferred`, and deliberately no third value for a guess. Everything this package produces is `inferred`, and must point at the call that inferred it.
3. **Deterministic code for anything that decides.** Scoring, deduplication, validation and state transitions stay out of this package entirely. The model interprets; it never decides.

## Goals / Non-Goals

**Goals:**

- One call path, one retry policy, one place where model output is validated.
- Prompts that are reviewed like code and versioned like migrations.
- Cost that is visible before it is a surprise.
- An audit record that makes an inferred fact traceable.

**Non-Goals:**

- A third provider implementation. Two ship here — Gemini and Cloudflare Workers AI, one per tier — because those are the keys the project holds; a third is future scope.
- Streaming, embeddings, vector search, or any retrieval mechanism.
- Any product-facing feature. The only prompt shipped here exists to test the machinery.
- A caching layer for identical prompts. Worth doing, not worth guessing at before there is a workload.

## Decisions

### D1 — A new workspace package `packages/ai`, not a NestJS module

**Choice:** the abstraction is a plain package exporting classes and functions. `apps/api` wraps it in a thin Nest module.

**Why:** the background worker process arrives in `add-background-jobs` and will run these same prompts outside the HTTP application. A package with no framework dependency runs in both. This matches the existing split — `packages/database` exports plain functions and `apps/api` wires them into DI.

### D2 — Two layers: `AIProvider` (transport) and `AIService` (contract)

```
packages/ai/
├─ src/
│  ├─ provider/
│  │  ├─ provider.ts            AIProvider interface
│  │  ├─ gemini.ts               default tier
│  │  ├─ cloudflare.ts           fast tier
│  │  └─ errors.ts              retryable vs terminal classification, per vendor
│  ├─ prompts/
│  │  ├─ registry.ts            name+version -> definition
│  │  └─ <name>/v1.ts           template, input type, output schema
│  ├─ service/
│  │  ├─ ai.service.ts          the only public entry point
│  │  ├─ validate.ts            parse, one repair attempt, then fail
│  │  └─ spend.ts               ceiling enforcement
│  └─ index.ts
└─ package.json
```

`AIProvider` knows about messages, tokens and HTTP failures. It knows nothing about prompts, schemas or cost ceilings. `AIService` knows nothing about HTTP.

### D3 — Two vendors, one per tier: Gemini and Cloudflare Workers AI

**Models:** `AI_MODEL_DEFAULT` defaults to `gemini-2.5-pro`, `AI_MODEL_FAST` to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Each prompt declares which of the two tiers it needs; a prompt doing evidence-weighted reasoning over a website analysis is not the same job as classifying an industry string — and unlike D1's original plan, that split is not just a price tier of one vendor, it is two separate `AIProvider` implementations.

**Why two vendors instead of one:** this is the project owner's provider choice — the API keys held are Gemini and Cloudflare, not Anthropic. `AIProvider` already existed to make this a contained change: each tier's `AIModelTier` config (in `packages/config`) now carries a `vendor` field, and the tier a prompt requests determines which implementation `AIService` calls. There is no runtime-selectable `AI_PROVIDER` variable, because the choice is not one axis — it is fixed per tier.

**Why Gemini for the default tier:** the SDK (`@google/genai`) supports function-calling-shaped structured output, which is how D4 gets schema conformance rather than JSON-in-prose, for the reasoning-heavy calls that most need it to hold.

**Why Cloudflare Workers AI for the fast tier:** cheap, and Workers AI's catalog includes instruction-tuned models with function-calling support — `AI_MODEL_FAST` must name one of those, since D4's structured-output path is not optional per tier.

**Deviation from the decided stack:** none in kind — the stack says "provider abstraction, structured + schema-validated outputs, versioned prompts" without naming a vendor. It is a deviation from this design's original D1, which planned one vendor first and treated a second as a later, optional addition; that non-goal no longer holds. `AIProvider`'s small transport interface (D2) is what makes carrying two from the start a contained cost rather than a rewrite.

### D4 — Structured output via tool definition, validated with Zod regardless

The output schema is converted to a JSON Schema and supplied as a single-tool definition, so the provider constrains generation rather than the parser hoping for the best. The response is *still* parsed with the Zod schema afterwards. Provider-side constraint is an optimisation; the Zod parse is the contract.

**On failure:** one repair attempt, re-sending the original request plus the validation error. A second failure throws. There is no third path — no defaults, no `partial: true`, no dropping the failing field. Those are the mechanisms by which a fabricated value gets written to a database that promised not to hold one.

### D5 — Prompts are modules, versions are immutable

Each prompt lives at `src/prompts/<name>/v<n>.ts` and exports `{ name, version, tier, inputSchema, outputSchema, render(input) }`. The registry is a frozen map built at module load, validated the way `packages/config` validates its own data — a duplicate name+version or a prompt whose `render` output omits its input fails at load, not at request time.

A published version is never edited. This is not ceremony: `ai_invocations` records the version, and the whole point of that column is that reading it tells you what the model was actually asked.

**Injection:** `render` produces a message where instructions and input occupy separate blocks, with the input delimited and never interpolated into the instruction string. Company descriptions and page text are attacker-controlled in the ordinary case — a website can say whatever it likes.

### D6 — `ai_invocations` and the reference from derived values

```sql
ai_invocations(
  id uuid primary key,
  prompt_name text not null,
  prompt_version integer not null,
  model text not null,
  tier text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  estimated_cost_usd numeric(10,6) not null,
  latency_ms integer not null,
  attempts integer not null,
  outcome ai_invocation_outcome not null,  -- succeeded | invalid_output | provider_error | refused_by_ceiling
  failure_code text,
  created_at timestamptz not null default now()
)
```

No prompt text, no response text, no key. Later changes add `ai_invocation_id` columns referencing this table with `ON DELETE RESTRICT` — deleting a company must not erase the record of what was spent analysing it.

**Cost is estimated, and the column says so.** Per-token prices live in `packages/config` as data, because they change and because a hardcoded price is a silently wrong number.

### D7 — Spend ceiling as a database query, not a counter

`AI_SPEND_CEILING_USD` over a rolling window (`AI_SPEND_WINDOW_HOURS`, default 24). Before each call, sum `estimated_cost_usd` over the window; refuse if the ceiling is met.

**Why a query rather than an in-memory counter:** the API and the worker are separate processes. An in-memory counter gives each of them its own ceiling, which is not a ceiling.

**Trade-off:** one extra query per call, and a race where concurrent calls can overshoot slightly. Accepted — the ceiling is a spending guard, not a transactional invariant, and the alternative is a lock on every model call.

### D8 — Failure classification

| Provider condition | Retryable | Notes |
|---|---|---|
| 429 rate limit | yes | honour `retry-after` when present |
| 5xx, connection reset, timeout | yes | exponential backoff with jitter |
| 401/403 authentication | no | a wrong key does not become right |
| 400 invalid request | no | a bug in the prompt |
| content refusal | no | recorded as an outcome, not retried |
| schema validation failure | once | D4's repair attempt, tracked separately from transport retries |

Every call is bounded by `AI_TIMEOUT_MS` (default 60000 — these are long analytical calls, not request-path work).

**Two vendors, one table.** Gemini and Cloudflare Workers AI signal these conditions differently — different status codes, different rate-limit headers — so each provider implementation maps its own vendor's responses onto this same retryable/terminal classification. The table is the contract; `gemini.ts` and `cloudflare.ts` each satisfy it independently.

### D9 — Testing

- **Unit, no network:** registry validation, prompt rendering including the injection case, output validation and the repair path, failure classification, cost estimation, spend-ceiling arithmetic.
- **Integration, real PostgreSQL:** invocation records written for success, validation failure and ceiling refusal; the `ON DELETE RESTRICT` behaviour.
- **A fake provider** implementing `AIProvider` drives every path deterministically. It is the only way to test "returns invalid output twice" at all.
- **No test calls a real provider.** A suite that needs a paid API key does not run in CI, and a suite that does not run is not a test.

## Risks / Trade-offs

- **Estimated cost drifts from billed cost** → the column is named `estimated_cost_usd`, prices are configuration, and a test asserts the arithmetic against a known token count. Reconciliation against provider billing is out of scope.
- **The repair attempt doubles cost on a bad prompt** → invocation records make a prompt with a high repair rate visible; the attempt count is stored per call.
- **A schema too strict for the model to satisfy** looks like a provider problem and is a prompt problem → the failure error names the prompt, the version and the failing fields, so it reads as what it is.
- **Prompt injection from scraped page content** → separate blocks and delimited input reduce it; it does not eliminate it. The real mitigation is downstream: nothing this package returns is trusted enough to write without validation, and no model output ever drives a state transition or an outreach send.
- **Two vendors from day one, not one** → carries more integration surface (and D9's "no test calls a real provider" now applies twice) than the original single-vendor plan. Accepted because it reflects which keys the project actually holds; `AIProvider`'s small interface (D2) is what keeps a second implementation a contained addition rather than a rewrite.
- **Cloudflare Workers AI's function-calling support is model-specific, not catalog-wide** → `AI_MODEL_FAST` must name a model that supports it; the default is chosen for that reason and changing it is a configuration decision to make deliberately, not a drop-in swap.
