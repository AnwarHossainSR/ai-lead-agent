import { eq } from "drizzle-orm";
import { z } from "zod";

import { uuidv7 } from "uuidv7";
import type { Executor } from "../client";
import {
  type LeadScoreSnapshotInsert,
  type LeadScoreSnapshotRow,
  leadScoreSnapshots,
} from "../schema/lead-score-snapshots";
import { parseInput } from "./errors";

export const insertLeadScoreSnapshotInputSchema = z.object({
  leadId: z.uuid("Expected the lead identifier."),
  companyId: z.uuid("Expected the company identifier."),
  websiteQualityScore: z.number().int().min(0).max(100),
  technologyFitScore: z.number().int().min(0).max(100),
  opportunityScore: z.number().int().min(0).max(100),
  contactScore: z.number().int().min(0).max(100),
  businessFitScore: z.number().int().min(0).max(100),
  totalScore: z.number().int().min(0).max(100),
  priority: z.string().trim().min(1),
  explanation: z.string().trim().min(1, "Expected a non-empty explanation."),
  weightVersion: z.number().int().positive("Expected a positive weight version."),
  evidenceRefs: z.record(z.string()),
  missing: z.array(z.string()).default([]),
});

export type InsertLeadScoreSnapshotInput = z.input<typeof insertLeadScoreSnapshotInputSchema>;

export async function insertLeadScoreSnapshot(
  executor: Executor,
  input: InsertLeadScoreSnapshotInput,
): Promise<LeadScoreSnapshotRow> {
  const value = parseInput("The lead score snapshot", insertLeadScoreSnapshotInputSchema, input);

  const [row] = await executor
    .insert(leadScoreSnapshots)
    .values({
      id: uuidv7(),
      leadId: value.leadId,
      companyId: value.companyId,
      websiteQualityScore: value.websiteQualityScore,
      technologyFitScore: value.technologyFitScore,
      opportunityScore: value.opportunityScore,
      contactScore: value.contactScore,
      businessFitScore: value.businessFitScore,
      totalScore: value.totalScore,
      priority: value.priority,
      explanation: value.explanation,
      weightVersion: value.weightVersion,
      evidenceRefs: value.evidenceRefs,
      missing: value.missing,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The lead score snapshot insert returned no row.");
  }

  return row;
}

export async function getLeadScoreSnapshots(
  executor: Executor,
  leadId: string,
): Promise<LeadScoreSnapshotRow[]> {
  return executor
    .select()
    .from(leadScoreSnapshots)
    .where(eq(leadScoreSnapshots.leadId, leadId))
    .orderBy(leadScoreSnapshots.createdAt);
}
