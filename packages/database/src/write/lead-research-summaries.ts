import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { uuidv7 } from "uuidv7";
import type { Executor } from "../client";
import {
  type LeadResearchSummaryRow,
  leadResearchSummaries,
} from "../schema/lead-research-summaries";
import { parseInput } from "./errors";

export const insertLeadResearchSummaryInputSchema = z.object({
  leadId: z.string().uuid("Expected the lead identifier."),
  companyId: z.string().uuid("Expected the company identifier."),
  sections: z.record(
    z.string(),
    z.array(
      z.object({
        text: z.string().trim().min(1),
        cites: z.array(z.string().trim().min(1)).min(1),
      }),
    ),
  ),
  citedFacts: z.array(z.string().trim().min(1)).min(1),
  unknownFacts: z.array(z.string().trim().min(1)).default([]),
  rejections: z
    .array(
      z.object({
        category: z.string().trim().min(1),
        count: z.number().int().nonnegative(),
      }),
    )
    .default([]),
  promptVersion: z.number().int().positive("Expected a positive prompt version."),
  aiInvocationId: z.string().uuid("Expected the AI invocation identifier."),
});

export type InsertLeadResearchSummaryInput = z.input<typeof insertLeadResearchSummaryInputSchema>;

export async function insertLeadResearchSummary(
  executor: Executor,
  input: InsertLeadResearchSummaryInput,
): Promise<LeadResearchSummaryRow> {
  const value = parseInput(
    "The lead research summary",
    insertLeadResearchSummaryInputSchema,
    input,
  );

  const [row] = await executor
    .insert(leadResearchSummaries)
    .values({
      id: uuidv7(),
      leadId: value.leadId,
      companyId: value.companyId,
      sections: value.sections,
      citedFacts: value.citedFacts,
      unknownFacts: value.unknownFacts,
      rejections: value.rejections,
      promptVersion: value.promptVersion,
      aiInvocationId: value.aiInvocationId,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The lead research summary insert returned no row.");
  }

  return row;
}

export async function getCurrentLeadResearchSummary(
  executor: Executor,
  leadId: string,
): Promise<LeadResearchSummaryRow | undefined> {
  const [row] = await executor
    .select()
    .from(leadResearchSummaries)
    .where(eq(leadResearchSummaries.leadId, leadId))
    .orderBy(desc(leadResearchSummaries.createdAt), desc(leadResearchSummaries.id))
    .limit(1);

  return row;
}

export async function getLeadResearchSummaryHistory(
  executor: Executor,
  leadId: string,
): Promise<LeadResearchSummaryRow[]> {
  return executor
    .select()
    .from(leadResearchSummaries)
    .where(eq(leadResearchSummaries.leadId, leadId))
    .orderBy(desc(leadResearchSummaries.createdAt), desc(leadResearchSummaries.id));
}
