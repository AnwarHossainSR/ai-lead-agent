import { desc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import { type WebsiteAnalysisRow, websiteAnalysis } from "../schema/website-analysis";
import {
  businessOpportunitiesSchema,
  observationsSchema,
  technologyStackSchema,
} from "../schemas/evidence";
import { parseInput } from "./errors";

/**
 * The write API for website analyses.
 *
 * Scores are `nullish` rather than defaulted: an unmeasured score is unknown,
 * and a default of 0 would report a site nobody could load as the worst site
 * ever measured. The JSONB payloads are validated against the evidence schemas
 * on the way in, which is what stops a claim without a source being stored.
 */

const score = z
  .number()
  .int("Expected a whole number between 0 and 100.")
  .min(0, "Expected a score of at least 0. An unmeasured score is omitted, not zero.")
  .max(100, "Expected a score of at most 100.")
  .nullish();

export const insertWebsiteAnalysisInputSchema = z.object({
  companyId: z.uuid("Expected the identifier of the company whose site was analyzed."),
  analyzedUrl: z.url("Expected the URL that was analyzed."),

  performanceScore: score,
  accessibilityScore: score,
  seoScore: score,
  mobileScore: score,
  uxScore: score,

  technologyStack: technologyStackSchema.default([]),
  observations: observationsSchema.default([]),
  businessOpportunities: businessOpportunitiesSchema.default([]),

  summary: z.string().trim().min(1, "Expected a summary or nothing at all.").nullish(),

  isExample: z.boolean().default(false),
});

export type InsertWebsiteAnalysisInput = z.input<typeof insertWebsiteAnalysisInputSchema>;

export async function insertWebsiteAnalysis(
  executor: Executor,
  input: InsertWebsiteAnalysisInput,
): Promise<WebsiteAnalysisRow> {
  const value = parseInput("The website analysis", insertWebsiteAnalysisInputSchema, input);

  const [row] = await executor
    .insert(websiteAnalysis)
    .values({
      id: uuidv7(),
      companyId: value.companyId,
      analyzedUrl: value.analyzedUrl,
      performanceScore: value.performanceScore ?? null,
      accessibilityScore: value.accessibilityScore ?? null,
      seoScore: value.seoScore ?? null,
      mobileScore: value.mobileScore ?? null,
      uxScore: value.uxScore ?? null,
      technologyStack: value.technologyStack,
      observations: value.observations,
      businessOpportunities: value.businessOpportunities,
      summary: value.summary ?? null,
      isExample: value.isExample,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The website analysis insert returned no row.");
  }

  return row;
}

/**
 * The most recent analysis for a company, or `undefined` when it has never
 * been analyzed — which is a different thing from an analysis that found
 * nothing, and reads differently at the call site.
 *
 * Ordered by `created_at DESC, id DESC`: UUID v7 is time-ordered, so the
 * identifier breaks a tie between two analyses written in the same
 * millisecond deterministically rather than leaving it to the planner.
 */
export async function getLatestWebsiteAnalysis(
  executor: Executor,
  companyId: string,
): Promise<WebsiteAnalysisRow | undefined> {
  const [row] = await executor
    .select()
    .from(websiteAnalysis)
    .where(eq(websiteAnalysis.companyId, companyId))
    .orderBy(desc(websiteAnalysis.createdAt), desc(websiteAnalysis.id))
    .limit(1);

  return row;
}
