import { z } from "zod";

import { uuidv7 } from "uuidv7";
import type { Executor } from "../client";
import {
  type OpportunityAnalysisRunRow,
  opportunityAnalysisRuns,
} from "../schema/opportunity-analysis-runs";
import { parseInput } from "./errors";

export const insertOpportunityAnalysisRunInputSchema = z.object({
  companyId: z.uuid("Expected the identifier of the company being analyzed."),
  websiteAnalysisId: z.uuid("Expected the website analysis identifier.").optional(),
  promptVersion: z.number().int().positive("Expected a positive prompt version."),
  outcome: z.enum(["opportunities", "insufficient_evidence", "below_threshold", "failed"]),
  acceptedCount: z.number().int().default(0),
  rejectedCount: z.number().int().default(0),
  rejections: z
    .array(
      z.object({
        reason: z.string().trim().min(1, "Expected a rejection reason."),
        count: z.number().int().default(0),
      }),
    )
    .default([]),
  aiInvocationId: z.uuid("Expected the AI invocation identifier.").nullish(),
});

export type InsertOpportunityAnalysisRunInput = z.input<
  typeof insertOpportunityAnalysisRunInputSchema
>;

export async function insertOpportunityAnalysisRun(
  executor: Executor,
  input: InsertOpportunityAnalysisRunInput,
): Promise<OpportunityAnalysisRunRow> {
  const value = parseInput(
    "The opportunity analysis run",
    insertOpportunityAnalysisRunInputSchema,
    input,
  );

  const [row] = await executor
    .insert(opportunityAnalysisRuns)
    .values({
      id: uuidv7(),
      companyId: value.companyId,
      websiteAnalysisId: value.websiteAnalysisId ?? null,
      promptVersion: value.promptVersion,
      outcome: value.outcome,
      acceptedCount: value.acceptedCount,
      rejectedCount: value.rejectedCount,
      rejections: value.rejections,
      aiInvocationId: value.aiInvocationId,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The opportunity analysis run insert returned no row.");
  }

  return row;
}
