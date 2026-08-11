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

## Cost and ceiling

- Every call estimates cost from token counts and the tier's configured per-million-token prices.
- The spend ceiling (`AI_SPEND_CEILING_USD` over `AI_SPEND_WINDOW_HOURS`) is checked before each call. When reached, the call is refused with `SpendCeilingError` and recorded as `refused_by_ceiling`.

## Testing

- Use `FakeAIProvider` for deterministic tests — it never calls a vendor.
- Enqueue scenarios: `valid`, `invalid_output`, `rate_limited`, `authentication_failed`, `hang`.
- The fake provider implements transport-level retry for `rate_limited` scenarios, matching real provider behaviour.
