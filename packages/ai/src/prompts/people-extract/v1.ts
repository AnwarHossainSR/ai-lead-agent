import { z } from "zod";
import type { RenderedPrompt } from "../prompt";
import { registerPrompt } from "../registry";
import { renderPrompt } from "../render";

/**
 * People extraction prompt v1.
 *
 * Extracts people's names, roles, and the text that names them from a page.
 * The output schema deliberately contains no email or telephone field — the
 * model is never asked for a contact detail (design D12).
 */

const NAME = "people-extract" as const;
const VERSION = 1 as const;
const TIER = "default" as const;

export const peopleExtractInputSchema = z.object({
  input: z.string().describe("The rendered text content of the page"),
  pageUrl: z.string().describe("The URL of the page being analysed"),
});

export type PeopleExtractInput = z.infer<typeof peopleExtractInputSchema>;

/**
 * Output schema — no email or telephone field by design.
 * Any such value appearing in the model output is discarded.
 */
export const peopleExtractOutputSchema = z.object({
  people: z
    .array(
      z.object({
        name: z.string().describe("The person's full name as stated on the page"),
        role: z
          .string()
          .optional()
          .describe("The person's job title or role as stated on the page"),
        namingText: z
          .string()
          .describe(
            "The exact text fragment from the page that names this person",
          ),
      }),
    )
    .describe("List of people found on the page"),
});

export type PeopleExtractOutput = z.infer<typeof peopleExtractOutputSchema>;

function render(input: PeopleExtractInput): RenderedPrompt {
  const instructions = `You extract people from a company's web page.

For each person you find, provide:
- Their full name exactly as shown on the page
- Their job title or role if stated
- The exact text fragment from the page that names them (namingText)

Rules:
- Only include people presented in a business capacity for the company
- Do NOT invent or guess contact details
- Do NOT include email addresses or phone numbers even if visible
- Use the exact text from the page for namingText — do not paraphrase
- If no people are found, return an empty array`;

  return renderPrompt(
    instructions,
    `Page URL: ${input.pageUrl}\n\nPage content:\n${input.input}`,
    "extract_people",
    "Extract people from the page content.",
    peopleExtractOutputSchema.toJSONSchema() as Record<string, unknown>,
  );
}

registerPrompt({
  name: NAME,
  version: VERSION,
  tier: TIER,
  inputSchema: peopleExtractInputSchema,
  outputSchema: peopleExtractOutputSchema,
  render: render as (input: unknown) => RenderedPrompt,
});
