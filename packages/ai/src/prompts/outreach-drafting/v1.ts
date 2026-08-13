import { z } from "zod";
import type { RenderedPrompt } from "../prompt";
import { registerPrompt } from "../registry";
import { renderPrompt } from "../render";

/**
 * Outreach drafting prompt v1.
 *
 * Receives a lead's stored facts — research summary, opportunities with their
 * citations, the chosen contact, the operator's service catalogue and the
 * channel constraints — and returns a personalised message draft:
 * a subject line where the channel uses one, a body, and the list of claims
 * the body makes with their citations.
 *
 * The model must not invent facts, promise outcomes, state prices or timelines,
 * or claim a prior relationship.
 *
 * Prompt construction (design D5/D9):
 * - Instructions and input occupy separate message blocks
 * - Input is structured records, not prose, reducing injection surface
 * - Call-local identifiers (s1, o1, c1…) are used for citations
 */
const NAME = "outreach-drafting" as const;
const VERSION = 1 as const;
const TIER = "default" as const;

const claimSchema = z.object({
  text: z.string().trim().min(1, "Expected a claim."),
  cites: z.array(z.string().trim().min(1)).min(1, "Expected at least one citation."),
});

export const outputSchema = z.object({
  subject: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1, "Expected a message body."),
  claims: z.array(claimSchema).min(1),
});

export const outreachDraftingOutputSchema = outputSchema;

export const outreachDraftingInputSchema = z.object({
  channel: z.object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    tone: z.string().trim().min(1),
    subjectApplies: z.boolean(),
    maxSubjectLength: z.number().int().positive(),
    maxBodyLength: z.number().int().positive(),
  }),
  summary: z.object({
    sections: z.array(z.string().trim().min(1)).min(1),
    citedFacts: z
      .array(
        z.object({
          ref: z.string().trim().min(1),
          detail: z.string().trim().min(1),
          url: z.string().url(),
        }),
      )
      .min(1),
  }),
  opportunities: z
    .array(
      z.object({
        ref: z.string().trim().min(1),
        title: z.string().trim().min(1),
        description: z.string().trim().min(1),
        impact: z.string().trim().min(1),
        citedEvidence: z.array(z.string().trim().min(1)).min(1),
      }),
    )
    .default([]),
  contact: z.object({
    name: z.string().trim().min(1),
    jobTitle: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(1).optional(),
    linkedinUrl: z.string().trim().url().optional(),
  }),
  services: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1),
        description: z.string().trim().min(1),
      }),
    )
    .min(1),
});

export type OutreachDraftingInput = z.infer<typeof outreachDraftingInputSchema>;
export type OutreachDraftingOutput = z.infer<typeof outputSchema>;

function render(input: OutreachDraftingInput): RenderedPrompt {
  const subjectInstruction = input.channel.subjectApplies
    ? `- Include a subject line of at most ${input.channel.maxSubjectLength} characters`
    : "- Do NOT include a subject line";

  const instructions = `You are drafting a personalised outreach message for a sales operator to send to a lead. The message will be reviewed by a human before it is sent.

The message must be:
- grounded only in the facts provided below
- in a ${input.channel.tone.toLowerCase()} tone appropriate for ${input.channel.name}
- free of invented facts
- free of promises of any outcome
- free of prices, rates, budgets, timelines or delivery commitments
- free of claims about prior contact, prior conversations or referrals
- explicitly honest about gaps: if a fact is missing, omit it rather than guess

Constraints:
${subjectInstruction}
- The body must be at most ${input.channel.maxBodyLength} characters
- Every specific claim about the recipient's business must cite one or more input identifiers
- Do NOT invent identifiers; only use identifiers present in the input
- The contact section lists the person you are writing to; do not address anyone else
- Reference the operator's services only when the input supports it`;

  const lines: string[] = [];
  lines.push(`Channel: ${input.channel.name} (${input.channel.id})`);
  lines.push(`Tone: ${input.channel.tone}`);
  if (input.channel.subjectApplies) {
    lines.push(`Subject limit: ${input.channel.maxSubjectLength} characters`);
  }
  lines.push(`Body limit: ${input.channel.maxBodyLength} characters`);

  lines.push(`\nResearch summary:`);
  for (const section of input.summary.sections) {
    lines.push(`- ${section}`);
  }

  if (input.summary.citedFacts.length > 0) {
    lines.push(`\nCited facts:`);
    for (const fact of input.summary.citedFacts) {
      lines.push(`- [${fact.ref}] ${fact.detail} (at ${fact.url})`);
    }
  }

  if (input.opportunities.length > 0) {
    lines.push(`\nOpportunities:`);
    for (const opportunity of input.opportunities) {
      lines.push(
        `- [${opportunity.ref}] ${opportunity.title}: ${opportunity.description} Impact: ${opportunity.impact} (cites: ${opportunity.citedEvidence.join(", ")})`,
      );
    }
  }

  lines.push(`\nContact:`);
  const contactDetails = [
    input.contact.name,
    input.contact.jobTitle,
    input.contact.email,
    input.contact.phone,
    input.contact.linkedinUrl,
  ]
    .filter(Boolean)
    .join(", ");
  lines.push(`- ${contactDetails}`);

  lines.push(`\nServices offered:`);
  for (const service of input.services) {
    lines.push(`- [${service.id}] ${service.name}: ${service.description}`);
  }

  const renderedInput = lines.join("\n");

  return renderPrompt(
    instructions,
    renderedInput,
    "produce_outreach_draft",
    "Generate a personalised outreach draft from stored lead facts",
    outputSchema.toJSONSchema() as Record<string, unknown>,
  );
}

registerPrompt({
  name: NAME,
  version: VERSION,
  tier: TIER,
  inputSchema: outreachDraftingInputSchema,
  outputSchema: outputSchema,
  render: render as (input: unknown) => RenderedPrompt,
});
