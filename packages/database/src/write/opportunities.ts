import { z } from "zod";

import { uuidv7 } from "uuidv7";
import type { Executor } from "../client";
import { type OpportunityRow, opportunities } from "../schema/opportunities";
import { parseInput } from "./errors";

export const insertOpportunityInputSchema = z.object({
  analysisRunId: z.uuid("Expected the opportunity analysis run identifier."),
  companyId: z.uuid("Expected the identifier of the company."),
  categoryId: z.string().trim().min(1, "Expected a category identifier."),
  serviceId: z.string().trim().min(1, "Expected a service identifier."),
  title: z.string().trim().min(1, "Expected a title."),
  description: z.string().trim().min(1, "Expected a description."),
  impact: z.string().trim().min(1, "Expected an impact description."),
  citedEvidence: z
    .array(z.string().trim().min(1, "Expected a evidence identifier."))
    .min(1, "At least one cited evidence is required."),
  aiInvocationId: z.uuid("Expected the AI invocation identifier."),
});

export type InsertOpportunityInput = z.input<typeof insertOpportunityInputSchema>;

export async function insertOpportunity(
  executor: Executor,
  input: InsertOpportunityInput,
): Promise<OpportunityRow> {
  const value = parseInput("The opportunity", insertOpportunityInputSchema, input);

  const [row] = await executor
    .insert(opportunities)
    .values({
      id: uuidv7(),
      runId: value.analysisRunId,
      companyId: value.companyId,
      categoryId: value.categoryId,
      serviceId: value.serviceId,
      title: value.title,
      description: value.description,
      impact: value.impact,
      certainty: "inferred" as const,
      citedEvidence: value.citedEvidence,
      aiInvocationId: value.aiInvocationId,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The opportunity insert returned no row.");
  }

  return row;
}
