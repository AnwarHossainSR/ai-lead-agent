# AI Prompts

How to add, version, and maintain prompts in `@mela/ai`.

## Prompt lifecycle

A prompt is a versioned module at `packages/ai/src/prompts/<name>/v<n>.ts`. It exports a `PromptDefinition` and registers itself with the frozen registry at module load time.

A published version is **never edited**. This is not ceremony — `ai_invocations` records the version, and the whole point of that column is that reading it tells you what the model was actually asked. A behavioural change is a new version.

## Adding a prompt

1. Create `src/prompts/<name>/v1.ts`.
2. Define `inputSchema` and `outputSchema` as Zod schemas.
3. Write a `render` function using the `renderPrompt` helper — this places instructions and input in separate blocks with the input delimited (design D5).
4. Call `registerPrompt(...)` at module top level.
5. Import the module from `src/prompts/index.ts` so it is loaded at startup.

```ts
// src/prompts/my-prompt/v1.ts
import { z } from "zod";
import { registerPrompt } from "../registry";
import { renderPrompt } from "../render";
import type { RenderedPrompt } from "../prompt";

const NAME = "my-prompt" as const;
const VERSION = 1 as const;
const TIER = "fast" as const;

const inputSchema = z.object({
  input: z.string().describe("The text to process"),
});

type Input = z.infer<typeof inputSchema>;

const outputSchema = z.object({
  result: z.enum(["yes", "no", "insufficient_evidence"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

function render(input: Input): RenderedPrompt {
  return renderPrompt(
    "You are a classifier. Analyse the input.",
    input.input,
    "classify",
    "Classify the input.",
    outputSchema.toJSONSchema() as Record<string, unknown>,
  );
}

registerPrompt({
  name: NAME,
  version: VERSION,
  tier: TIER,
  inputSchema,
  outputSchema,
  render: render as (input: unknown) => RenderedPrompt,
});
```

## Render conventions (design D5)

- Instructions and input occupy **separate messages** — never concatenated.
- The input is delimited with `<=== INPUT BEGIN ===>` and `<=== INPUT END ===>` markers.
- Input text is **never interpolated** into instruction text. This confines attacker-controlled content (e.g. scraped page text) to the data block.

## Output schema

- Always include an `"insufficient_evidence"` outcome when the model may not have enough information. This is a valid result, not an error.
- The output schema is converted to JSON Schema via Zod v4's `toJSONSchema()` and supplied as a single-tool definition to the provider.
- The Zod parse is the contract; the provider-side tool constraint is an optimisation.

## Validation and repair (design D4)

1. The provider's response is parsed against the output schema.
2. On failure, one **repair attempt** sends the validation error back to the model.
3. A second failure throws `OutputValidationError` naming the prompt, version, and failing fields.
4. No defaults, no `partial: true`, no dropping failing fields.

## Opportunity Analysis Prompt (opportunity-analysis, v1)

This is the core prompt for identifying business opportunities from company website evidence.

### Prompt Definition

- **Name**: `opportunity-analysis`
- **Version**: `1`
- **Tier**: `default`

### Input Schema (`opportunityAnalysisInputSchema`)

```ts
export const opportunityAnalysisInputSchema = z.object({
  industry: z.string().trim().min(1, "Expected the company's industry."),
  country: z.string().trim().min(1, "Expected the company's country."),
  observations: z
    .array(
      z.object({
        ref: z.string().describe("Call-local identifier for this observation"),
        kind: z.string().describe("Type of observation"),
        detail: z.string().trim().min(1, "Expected a statement of what was observed"),
        url: z.url("Expected the URL the observation was found at"),
      }),
    )
    .default([]),
  detections: z
    .array(
      z.object({
        ref: z.string().describe("Call-local identifier for this detection"),
        kind: z.string().describe("Type of detection"),
        detail: z.string().trim().min(1, "Expected a statement of what was detected"),
        url: z.url("Expected the URL the detection evidence was found at"),
      }),
    )
    .default([]),
  serviceCatalogue: z
    .array(
      z.object({
        id: z.string().describe("Service identifier"),
        name: z.string().describe("Human-readable service name"),
      }),
    )
    .default([]),
});
```

### Output Schema (`opportunityAnalysisOutputSchema`)

A discriminated union with two branches:

- **`opportunities`** — list of identified business opportunities, each must:
  - Cite one or more evidence identifiers present in the input (`o1`, `t1`, etc.)
  - Name exactly one of the configured services (`categoryId`)
  - Describe impact as prose — no monetary figures, percentages, or deal sizes
  - Provide a title and description in own words

- **`insufficient_evidence`** — model reports that the evidence does not support any opportunity; includes a `reason` string.

```ts
export const opportunityAnalysisOutputSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("opportunities"),
    opportunities: z
      .array(
        z.object({
          categoryId: z.string().describe("Resolved against configured taxonomy"),
          title: z.string().trim().min(1, "Expected an opportunity title"),
          description: z
            .string()
            .trim()
            .min(1, "Expected an opportunity description"),
          impact: z
            .string()
            .trim()
            .min(1, "Expected a prose description of business impact")
            .describe("Impact is prose describing business consequence, never a number"),
          citedEvidence: z
            .array(z.string().trim().min(1))
            .min(1, "At least one cited evidence identifier is required"),
        }),
      )
      .describe("List of identified business opportunities"),
  }),
  z.object({
    outcome: z.literal("insufficient_evidence"),
    reason: z.string().trim().min(1, "Expected a reason for insufficient evidence"),
  }),
);
```

### Render Function

The prompt input is structured records, not prose, reducing injection surface (design D5):

- Instructions and input occupy separate message blocks
- Input contains call-local identifiers (`o1`, `o2`, `t1`, `t2`, etc.)
- The AI must pick category from the service catalogue and cite evidence identifiers it rests on
- Impact must be prose describing business consequence — never quantified

### Validation and Repair (design D4)

1. The provider's response is parsed against the output schema.
2. On failure, one repair attempt sends the validation error back to the model.
3. A second failure throws `OutputValidationError` naming the prompt, version, and failing fields.
4. **No defaults, no `partial: true`, no dropping failing fields** — these are the mechanisms by which a fabricated value enters a database that promised not to hold one.

### Design Notes

- **No monetary/percentage/duration/deal-size** — the impact field must be prose describing business consequence
- **Call-local identifiers for citations** — `o1`, `o2` for observations; `t1`, `t2` for detections; the output must only cite identifiers present in the input
- **Unknown attributes omitted** — never describe an attribute as "unknown"; just omit it
- **Service catalogue required** — every opportunity must name exactly one configured service

### Cost and Ceiling

- Every call estimates cost from token counts and the tier's configured per-million-token prices.
- The spend ceiling (`AI_SPEND_CEILING_USD` over `AI_SPEND_WINDOW_HOURS`) is checked before each call. When reached, the call is refused with `SpendCeilingError` and recorded as `refused_by_ceiling`.

### Testing

- Use `FakeAIProvider` for deterministic tests — it never calls a vendor.
- Enqueue scenarios: `valid`, `invalid_output`, `rate_limited`, `authentication_failed`, `hang`.
- The fake provider implements transport-level retry for `rate_limited` scenarios, matching real provider behaviour.
- Output is validated against the Zod schema with one repair attempt; tests verify the repair mechanism works correctly.
