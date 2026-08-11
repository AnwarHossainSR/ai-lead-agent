# Add AI Provider Abstraction

**Roadmap coverage:** the `AI: provider abstraction (AIProvider/AIService), structured + schema-validated outputs, versioned prompts` line of the decided stack. Prerequisite for business opportunity analysis, AI research summaries and outreach drafting.

## Why

Three later changes need a language model: opportunity analysis, research summary, and outreach drafting. If each one calls a provider SDK directly, three things go wrong at once — three different retry policies, three places where an unvalidated model response can reach the database, and no single answer to "what did this cost and where did this claim come from".

The product principles make the requirements unusually specific. AI output is *inference*, and the data model already distinguishes inference from observation, so every AI-derived value has to be traceable back to the call that produced it — which model, which prompt version, what it was given. A summary that cannot be traced is indistinguishable from a fabricated one.

Building this first also keeps the boundary honest: the abstraction has no idea what a lead is. It runs a named, versioned prompt against typed input and returns a value that satisfies a Zod schema, or it fails. Nothing about scoring, deduplication or status transitions is allowed to depend on it.

## What Changes

**New package `packages/ai`**

- `AIProvider` — the thin transport interface over one vendor: send a request, get a response, surface usage. One implementation to start (Anthropic).
- `AIService` — the only thing application code calls. Takes a registered prompt name, a version, and typed input; returns output parsed by that prompt's Zod schema.
- A prompt registry where each prompt is a versioned module exporting its template, its input type, and its output schema. Prompt text is code, reviewed in pull requests, never assembled from user input.
- Structured output requested from the provider and then validated. A response that does not satisfy the schema is retried once with the validation error, then fails — it is never coerced, defaulted or partially accepted.
- Usage and cost accounting per call, and a configurable spend ceiling that refuses further calls rather than silently running up a bill.
- Redaction so no API key and no full prompt payload reaches the logs.

**Data model**

- An `ai_invocations` table recording prompt name, prompt version, model, token counts, estimated cost, latency, and outcome. Later changes attach the invocation id to every field they derive from a model, which is what makes an inferred fact auditable.

**Environment**

- `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `AI_MODEL_DEFAULT`, `AI_MODEL_FAST`, `AI_MAX_OUTPUT_TOKENS`, `AI_SPEND_CEILING_USD` added to the validated schema and to `.env.example`.

## Capabilities

### New Capabilities

- `ai-provider`: The platform's single path to a language model — a vendor-agnostic transport interface, versioned prompts held as reviewed code, schema-validated structured output with no coercion, per-call usage and cost accounting with a spend ceiling, and an audit record that later capabilities attach to every fact they infer.

### Modified Capabilities

- `lead-data-model`: adds the `ai_invocations` audit table that AI-derived facts reference.
- `developer-environment`: adds the AI provider environment variables, with the API key treated as a secret that never appears in logs or error messages.

## Impact

- New workspace package `packages/ai`, depended on by `apps/api` and (later) the worker process.
- New dependency `@anthropic-ai/sdk`. No AI dependency currently exists in the repository.
- One new migration in `packages/database`.
- `apps/api` gains an AI module wiring `AIService` into Nest DI; no HTTP route in this change.

## Non-goals

Deliberately deferred:

- **Any product feature that uses AI** — opportunity analysis, research summaries and outreach drafts are their own changes. This change ships the mechanism and one throwaway prompt used only by its tests.
- **A second provider implementation** — the interface exists so a second one is possible, but building one now would be designing against an imaginary requirement.
- **Streaming responses** — nothing in the pipeline renders tokens as they arrive; every call is a background analysis with a structured result.
- **Embeddings, vector storage, retrieval** — no capability needs them yet.
- **Automatic outreach** — this change makes drafting possible later. Human approval before sending is unchanged and non-negotiable.
