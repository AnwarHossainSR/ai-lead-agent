import type { z } from "zod";

import type { AIMessage, AIToolDefinition } from "../provider/provider";

/**
 * The render output — messages the provider receives, plus the single-tool
 * definition that constrains generation (design D4). Instructions and input
 * occupy separate messages; the input is delimited and never interpolated
 * into the instruction text (design D5/D9).
 */
export interface RenderedPrompt {
  readonly messages: readonly AIMessage[];
  readonly tool: AIToolDefinition;
}

/**
 * A versioned prompt module — reviewed like code, immutable once published
 * (design D5). Each prompt lives at `src/prompts/<name>/v<n>.ts` and
 * registers itself with the frozen registry at module load time.
 *
 * `render` is a pure function: it takes typed input and returns structured
 * messages plus a tool definition. It never mutates the input and never
 * reads external state.
 *
 * `tier` is a string matching one of the configured `AIModelTier` IDs
 * (e.g. `"default"` or `"fast"`). It is validated at resolution time by
 * `resolveAIModelTier` from `@mela/config`.
 */
export interface PromptDefinition<Input = unknown> {
  readonly name: string;
  readonly version: number;
  readonly tier: string;
  readonly inputSchema: z.ZodType<Input>;
  readonly outputSchema: z.ZodType;
  readonly render: (input: Input) => RenderedPrompt;
}

/**
 * A prompt definition with output schema narrowed to a specific type, used
 * by callers that know the expected output shape.
 */
export interface TypedPromptDefinition<Input = unknown, Output = unknown>
  extends Omit<PromptDefinition<Input>, "outputSchema"> {
  readonly outputSchema: z.ZodType<Output>;
}

/** String key for the registry: `name@version`. */
export function promptRegistryKey(name: string, version: number): string {
  return `${name}@${version}`;
}
