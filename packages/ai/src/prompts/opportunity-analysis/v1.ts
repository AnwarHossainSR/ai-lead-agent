import { z } from "zod";
import type { RenderedPrompt } from "../prompt";
import { registerPrompt } from "../registry";
import { renderPrompt } from "../render";

/**
 * Opportunity analysis prompt v1.
 *
 * Receives a company's observed website evidence and technology detections,
 * along with the operator's service catalogue. The model must produce
 * opportunities that cite the evidence identifiers they rest on, or report
 * insufficient insufficient evidence. Impact is described as prose, never quantified.
 *
 * Prompt construction (design D5/D9):
 * - Instructions and input occupy separate message blocks
 * - Input is structured records, not prose, reducing injection surface
 * - Call-local identifiers (o1, o2, t1…) are used for citations
 */
const NAME = "opportunity-analysis" as const;
const VERSION = 1 as const;
const TIER = "default" as const;

/**
 * Input: observations, detections, company attributes, and service catalogue.
 * Instructions and input are kept separate blocks; identifiers enable
 * citation without exposing database UUIDs (design D4).
 */
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

export type OpportunityAnalysisInput = z.infer<typeof opportunityAnalysisInputSchema>;

/**
 * Output: discriminated union of opportunities or insufficient evidence.
 * - every opportunity must cite evidence identifiers present in the input
 * - impact is prose describing business consequence, never a number
 * - insufficient_evidence is a distinct branch, not an empty array
 */
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
            .min(1, "Expected a prose description of business impact"),
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
]);

export type OpportunityAnalysisOutput = z.infer<typeof opportunityAnalysisOutputSchema>;

function render(input: OpportunityAnalysisInput): RenderedPrompt {
  const instructions = `You are analysing a company's website evidence to identify business opportunities.

The operator offers a fixed set of services. Every opportunity you produce must:
- cite the evidence identifiers it rests on (e.g. o1, t1)
- name exactly one of the configured services
- describe the impact as prose — no monetary figures, percentages, or deal sizes
- if the evidence does not support any opportunity, say "insufficient_evidence"

Instructions and input occupy separate blocks. The input contains:
- Observations about the website with call-local identifiers (o1, o2, …)
- Technology detections with call-local identifiers (t1, t2, …)
- The company's industry and country
- The operator's service catalogue

For each opportunity you produce:
1. Pick a categoryId from the service catalogue
2. Provide a title, description and impact in your own words
3. Cite one or more evidence identifiers that support this opportunity
4. If you cannot support any opportunity, output "insufficient_evidence" with a reason

Rules:
- Only include opportunities that cite identifiers present in the input
- Do NOT invent or guess evidence identifiers
- Do NOT describe unknown attributes as unknown — just omit them
- Impact must be prose describing business consequence
- If no opportunities are supported, output "insufficient_evidence"`;

  const renderedInput = `Industry: ${input.industry}\nCountry: ${input.country}\n\nObservations:\n${input.observations.map((o) => `- [${o.ref}] ${o.detail} (at ${o.url})`).join("\n")}\n\nTechnology detections:\n${input.detections.map((d) => `- [${d.ref}] ${d.detail} (at ${d.url})`).join("\n")}\n\nService catalogue:\n${input.serviceCatalogue.map((s) => `- ${s.id}: ${s.name}`).join("\n")}`;

  return renderPrompt(
    instructions,
    renderedInput,
    "cite_evidence_and_identify_opportunities",
    "Identify business opportunities from company evidence",
    opportunityAnalysisOutputSchema.toJSONSchema() as Record<string, unknown>,
  );
}

registerPrompt({
  name: NAME,
  version: VERSION,
  tier: TIER,
  inputSchema: opportunityAnalysisInputSchema,
  outputSchema: opportunityAnalysisOutputSchema,
  render: render as (input: unknown) => RenderedPrompt,
});