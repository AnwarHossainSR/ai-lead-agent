import { z } from "zod";
import type { RenderedPrompt } from "../prompt";
import { registerPrompt } from "../registry";
import { renderPrompt } from "../render";

/**
 * Test-only prompt for exercising the prompt registry machinery (design D9).
 * Not shipped to production — exists solely to validate:
 *
 * - Registration and lookup
 * - Render conventions (separate blocks, delimited input)
 * - Output schema validation with an "insufficient evidence" outcome
 * - Injection containment
 */

const NAME = "test-classify" as const;
const VERSION = 1 as const;
const TIER = "fast" as const;

export const testClassifyInputSchema = z.object({
  input: z.string().describe("The text to classify"),
});

export type TestClassifyInput = z.infer<typeof testClassifyInputSchema>;

export const testClassifyOutputSchema = z.object({
  classification: z
    .enum(["needs_website", "no_need", "insufficient_evidence"])
    .describe("The classification result"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score between 0 and 1"),
  reasoning: z
    .string()
    .describe("Brief explanation of the classification"),
});

export type TestClassifyOutput = z.infer<typeof testClassifyOutputSchema>;

function render(input: TestClassifyInput): RenderedPrompt {
  return renderPrompt(
    "You are a test classifier. Classify the input text.",
    input.input,
    "classify_result",
    "Classify the input text as needs_website, no_need, or insufficient_evidence.",
    {
      type: "object",
      properties: {
        classification: {
          type: "string",
          enum: ["needs_website", "no_need", "insufficient_evidence"],
        },
        confidence: { type: "number" },
        reasoning: { type: "string" },
      },
      required: ["classification", "confidence", "reasoning"],
    },
  );
}

registerPrompt({
  name: NAME,
  version: VERSION,
  tier: TIER,
  inputSchema: testClassifyInputSchema,
  outputSchema: testClassifyOutputSchema,
  render: render as (input: unknown) => RenderedPrompt,
});
