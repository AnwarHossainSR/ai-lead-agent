import { z } from "zod";
import type { RenderedPrompt } from "../prompt";
import { registerPrompt } from "../registry";
import { renderPrompt } from "../render";

/**
 * Outreach response classification prompt v1.
 *
 * Classifies a reply into one of the configured response categories, or marks
 * it as unclassified when no category fits. The output includes the basis text
 * from the reply that justifies the classification, so the caller can verify
 * the model grounded its decision in the actual message.
 */

const NAME = "outreach-response-classification" as const;
const VERSION = 1 as const;
const TIER = "fast" as const;

export const outreachResponseClassificationInputSchema = z.object({
  replyText: z.string().trim().min(1, "Expected the reply text."),
  outreachChannel: z.string().trim().min(1, "Expected the outreach channel."),
  categories: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1),
        description: z.string().trim().min(1),
      }),
    )
    .min(1, "Expected at least one category."),
});

export type OutreachResponseClassificationInput = z.infer<
  typeof outreachResponseClassificationInputSchema
>;

const classificationSchema = z.object({
  categoryId: z.string().trim().min(1),
  basisText: z.string().trim().min(1),
  isClassified: z.boolean(),
});

export const outreachResponseClassificationOutputSchema = classificationSchema;

export type OutreachResponseClassificationOutput = z.infer<
  typeof outreachResponseClassificationOutputSchema
>;

function render(input: OutreachResponseClassificationInput): RenderedPrompt {
  const categoriesList = input.categories
    .map((c) => `- ${c.id}: ${c.name} — ${c.description}`)
    .join("\n");

  const instructions = `You are classifying a reply to an outreach message. Choose the single best category from the list below, or mark it unclassified if none fits.

Categories:
${categoriesList}

Rules:
- The category must be one of the listed identifiers
- basisText must be a verbatim substring from the reply
- If no category fits, set isClassified to false, categoryId to "unclassified", and basisText to the reason why none fits`;

  const renderedInput = `Channel: ${input.outreachChannel}\n\nReply:\n${input.replyText}`;

  return renderPrompt(
    instructions,
    renderedInput,
    "classify_outreach_response",
    "Classify an outreach reply into a category with grounding basis",
    classificationSchema.toJSONSchema() as Record<string, unknown>,
  );
}

registerPrompt({
  name: NAME,
  version: VERSION,
  tier: TIER,
  inputSchema: outreachResponseClassificationInputSchema,
  outputSchema: classificationSchema,
  render: render as (input: unknown) => RenderedPrompt,
});
