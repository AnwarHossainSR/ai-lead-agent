import { z } from "zod";
import type { RenderedPrompt } from "../prompt";
import { registerPrompt } from "../registry";
import { renderPrompt } from "../render";

/**
 * Research summary prompt v1.
 *
 * Receives a lead's stored facts — company attributes, analysis observations,
 * technology detections, opportunities with their citations, contacts with their
 * sources, the score and its components — and returns a structured summary:
 * what the business appears to do, what was observed about its web presence,
 * the opportunities and what they rest on, who could be contacted, and
 * how to open a conversation.
 *
 * Every claim must cite an identifier present in the input. The model must
 * not invent facts or make prohibited claims about finances, headcount,
 * hiring, growth, plans or customer counts.
 *
 * Prompt construction (design D4/D5):
 * - Instructions and input occupy separate message blocks
 * - Input is structured records, not prose, reducing injection surface
 * - Call-local identifiers (b1, w1, o1, c1…) are used for citations
 */
const NAME = "research-summary" as const;
const VERSION = 1 as const;
const TIER = "default" as const;

const claimSchema = z.object({
  text: z.string().trim().min(1, "Expected a claim."),
  cites: z.array(z.string().trim().min(1)).min(1, "Expected at least one citation."),
});

const sectionsSchema = z.object({
  business: z.array(claimSchema).max(10),
  webPresence: z.array(claimSchema).max(10),
  opportunities: z.array(claimSchema).max(10),
  people: z.array(claimSchema).max(10),
  approach: z.array(claimSchema).max(3),
});

export const researchSummaryInputSchema = z.object({
  company: z.object({
    name: z.string().trim().min(1),
    industry: z.string().trim().min(1),
    country: z.string().trim().min(1),
    city: z.string().trim().min(1),
    website: z.string().trim().min(1),
    linkedinUrl: z.string().trim().min(1).optional(),
    companySize: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
  }),
  observations: z
    .array(
      z.object({
        ref: z.string().describe("Call-local identifier for this observation"),
        detail: z.string().trim().min(1),
        url: z.string().url(),
      }),
    )
    .default([]),
  detections: z
    .array(
      z.object({
        ref: z.string().describe("Call-local identifier for this detection"),
        name: z.string().trim().min(1),
        category: z.string().trim().min(1),
        detail: z.string().trim().min(1),
        url: z.string().url(),
      }),
    )
    .default([]),
  opportunities: z
    .array(
      z.object({
        ref: z.string().describe("Call-local identifier for this opportunity"),
        title: z.string().trim().min(1),
        description: z.string().trim().min(1),
        impact: z.string().trim().min(1),
        citedEvidence: z.array(z.string().trim().min(1)).min(1),
      }),
    )
    .default([]),
  contacts: z
    .array(
      z.object({
        ref: z.string().describe("Call-local identifier for this contact"),
        name: z.string().trim().min(1),
        jobTitle: z.string().trim().min(1).optional(),
        email: z.string().trim().email().optional(),
        phone: z.string().trim().min(1).optional(),
        linkedinUrl: z.string().trim().url().optional(),
      }),
    )
    .default([]),
  score: z.object({
    total: z.number().int().min(0).max(100),
    priority: z.string().trim().min(1),
    components: z.record(z.string().trim().min(1), z.number().int().min(0).max(100)),
    explanation: z.string().trim().min(1),
  }),
});

export type ResearchSummaryInput = z.infer<typeof researchSummaryInputSchema>;

export const researchSummaryOutputSchema = sectionsSchema;

export type ResearchSummaryOutput = z.infer<typeof researchSummaryOutputSchema>;

function render(input: ResearchSummaryInput): RenderedPrompt {
  const instructions = `You are writing a research summary for a sales operator about a company they are about to contact.

The summary must be:
- grounded only in the facts provided below
- free of invented facts
- free of prohibited claims about finances, headcount, hiring, growth, plans or customer counts
- a list of short statements per section, each citing the evidence it rests on
- explicitly honest about gaps: if a fact is missing, omit it rather than guess

Sections:
- business: what this company appears to do
- webPresence: what was observed about its site
- opportunities: what could be offered, and on what basis
- people: who could be contacted
- approach: how to open a conversation, grounded in the above (max 3 claims)

Rules:
- Every claim must cite one or more input identifiers
- Do NOT invent identifiers; only use identifiers present in the input
- Do NOT make prohibited claims: revenue, turnover, profit, valuation, funding, raised, ARR, budget, employees, headcount, staff of, team of, hiring, recruiting, expanding the team, open roles, growing rapidly, scaling, expanding into, market leader, plans to, intends to, is about to, roadmap, serves, customer base of, client base of
- If you cannot support a section, return an empty array for that section
- Do NOT describe unknown attributes as unknown — just omit them
- approach must be grounded in the company's evidence and must be <= 3 claims`;

  const lines: string[] = [];
  lines.push(`Company:`);
  lines.push(`- name: ${input.company.name}`);
  lines.push(`- industry: ${input.company.industry}`);
  lines.push(`- country: ${input.company.country}`);
  lines.push(`- city: ${input.company.city}`);
  lines.push(`- website: ${input.company.website}`);
  if (input.company.linkedinUrl) lines.push(`- linkedin: ${input.company.linkedinUrl}`);
  if (input.company.companySize) lines.push(`- company_size: ${input.company.companySize}`);
  if (input.company.description) lines.push(`- description: ${input.company.description}`);

  lines.push(`\nLead score:`);
  lines.push(`- total: ${input.score.total}`);
  lines.push(`- priority: ${input.score.priority}`);
  lines.push(`- components: ${Object.entries(input.score.components).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  lines.push(`- explanation: ${input.score.explanation}`);

  if (input.observations.length > 0) {
    lines.push(`\nObservations:`);
    for (const observation of input.observations) {
      lines.push(`- [${observation.ref}] ${observation.detail} (at ${observation.url})`);
    }
  }

  if (input.detections.length > 0) {
    lines.push(`\nTechnology detections:`);
    for (const detection of input.detections) {
      lines.push(`- [${detection.ref}] ${detection.name} (${detection.category}): ${detection.detail} (at ${detection.url})`);
    }
  }

  if (input.opportunities.length > 0) {
    lines.push(`\nOpportunities:`);
    for (const opportunity of input.opportunities) {
      lines.push(`- [${opportunity.ref}] ${opportunity.title}: ${opportunity.description} Impact: ${opportunity.impact} (cites: ${opportunity.citedEvidence.join(", ")})`);
    }
  }

  if (input.contacts.length > 0) {
    lines.push(`\nContacts:`);
    for (const contact of input.contacts) {
      const details = [contact.name, contact.jobTitle, contact.email, contact.phone, contact.linkedinUrl].filter(Boolean).join(", ");
      lines.push(`- [${contact.ref}] ${details}`);
    }
  }

  const renderedInput = lines.join("\n");

  return renderPrompt(
    instructions,
    renderedInput,
    "produce_cited_summary_sections",
    "Generate a structured research summary from stored company facts",
    researchSummaryOutputSchema.toJSONSchema() as Record<string, unknown>,
  );
}

registerPrompt({
  name: NAME,
  version: VERSION,
  tier: TIER,
  inputSchema: researchSummaryInputSchema,
  outputSchema: researchSummaryOutputSchema,
  render: render as (input: unknown) => RenderedPrompt,
});
