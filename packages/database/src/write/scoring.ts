import { and, eq } from "drizzle-orm";
import { z } from "zod";

import type { Executor } from "../client";
import { leads } from "../schema/leads";
import { leadScoreSnapshots } from "../schema/score-snapshots";
import { WriteValidationError } from "./errors";

export const updateLeadScoreInputSchema = z
  .object({
    leadId: z.uuid("Expected the identifier of the lead to update."),
    scores: z.object({
      business_fit: z.number().int().min(0).max(100),
      technical_opportunity: z.number().int().min(0).max(100),
      business_opportunity: z.number().int().min(0).max(100),
      decision_maker_found: z.number().int().min(0).max(100),
      company_quality: z.number().int().min(0).max(100),
    }),
    explanation: z.string().trim().min(1, "Expected an explanation of how this score was reached."),
    weightVersion: z.number().int().min(1),
    evidenceRefs: z.string().min(1, "Expected evidence references."),
    missing: z.string().min(1, "Expected missing evidence list."),
  })
  .strict();

export type UpdateLeadScoreInput = z.input<typeof updateLeadScoreInputSchema>;

export async function updateLeadScore(
  executor: Executor,
  input: UpdateLeadScoreInput,
): Promise<void> {
  const value = z
    .object({
      leadId: z.uuid(),
      scores: z.object({
        business_fit: z.number().int().min(0).max(100),
        technical_opportunity: z.number().int().min(0).max(100),
        business_opportunity: z.number().int().min(0).max(100),
        decision_maker_found: z.number().int().min(0).max(100),
        company_quality: z.number().int().min(0).max(100),
      }),
      explanation: z.string().trim().min(1),
      weightVersion: z.number().int().min(1),
      evidenceRefs: z.string().min(1),
      missing: z.string().min(1),
    })
    .strict()
    .parse(input);

  const total =
    value.scores.business_fit +
    value.scores.technical_opportunity +
    value.scores.business_opportunity +
    value.scores.decision_maker_found +
    value.scores.company_quality;

  if (total < 0 || total > 100) {
    throw new WriteValidationError("The lead score", [
      `Total score ${total} is outside the valid range 0 to 100.`,
    ]);
  }

  const [updated] = await executor
    .update(leads)
    .set({
      businessFitScore: value.scores.business_fit,
      technicalOpportunityScore: value.scores.technical_opportunity,
      businessOpportunityScore: value.scores.business_opportunity,
      decisionMakerFoundScore: value.scores.decision_maker_found,
      companyQualityScore: value.scores.company_quality,
      leadScore: total,
      scoreExplanation: value.explanation,
      weightVersion: value.weightVersion,
      scoredAt: new Date(),
    } as const)
    .where(eq(leads.id, value.leadId))
    .returning();

  if (updated === undefined) {
    throw new WriteValidationError("The lead score update", [
      `Lead ${value.leadId} was not found. Nothing was written.`,
    ]);
  }
}

export async function insertLeadScoreSnapshot(
  executor: Executor,
  input: {
    leadId: string;
    companyId: string;
    scores: {
      business_fit: number;
      technical_opportunity: number;
      business_opportunity: number;
      decision_maker_found: number;
      company_quality: number;
    };
    total: number;
    priority: string;
    explanation: string;
    weightVersion: number;
    evidenceRefs: string;
    missing: string;
  },
): Promise<void> {
  await executor.insert(leadScoreSnapshots).values({
    leadId: input.leadId,
    companyId: input.companyId,
    websiteQualityScore: input.scores.business_fit,
    technologyFitScore: input.scores.technical_opportunity,
    opportunityScore: input.scores.business_opportunity,
    contactScore: input.scores.decision_maker_found,
    businessFitScore: input.scores.company_quality,
    totalScore: input.total,
    priority: input.priority,
    explanation: input.explanation,
    weightVersion: input.weightVersion,
    evidenceRefs: input.evidenceRefs,
    missing: input.missing,
  });
}

export async function listStaleLeads(executor: Executor, currentWeightVersion: number) {
  return executor
    .select()
    .from(leads)
    .where(and(eq(leads.weightVersion, currentWeightVersion - 1)));
}

export type LeadScoreSnapshotWithDiff = {
  id: string;
  leadId: string;
  companyId: string;
  websiteQualityScore: number;
  technologyFitScore: number;
  opportunityScore: number;
  contactScore: number;
  businessFitScore: number;
  totalScore: number;
  priority: string;
  explanation: string;
  weightVersion: number;
  evidenceRefs: string;
  missing: string;
  createdAt: Date;
  changedComponents: string[];
};

export function compareSnapshots(
  older: typeof leadScoreSnapshots.$inferSelect,
  newer: typeof leadScoreSnapshots.$inferSelect,
): LeadScoreSnapshotWithDiff {
  const changedComponents: string[] = [];

  if (older.websiteQualityScore !== newer.websiteQualityScore)
    changedComponents.push("website_quality");
  if (older.technologyFitScore !== newer.technologyFitScore)
    changedComponents.push("technology_fit");
  if (older.opportunityScore !== newer.opportunityScore)
    changedComponents.push("opportunity_strength");
  if (older.contactScore !== newer.contactScore) changedComponents.push("contact_reachability");
  if (older.businessFitScore !== newer.businessFitScore) changedComponents.push("business_fit");

  return {
    ...newer,
    changedComponents,
  };
}
