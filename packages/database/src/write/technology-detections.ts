import { desc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import { type TechnologyDetectionRow, technologyDetections } from "../schema/technology-detections";
import { websiteAnalysis } from "../schema/website-analysis";
import { parseInput } from "./errors";

/**
 * The write API for technology detections.
 *
 * `company_id` is derived from the analysis, never accepted from the caller.
 * An observation can be upgraded from inferred to observed, never downgraded.
 */

export const insertTechnologyDetectionInputSchema = z.object({
  analysisId: z.uuid("Expected the analysis identifier."),
  fingerprintId: z.string().min(1, "Expected a fingerprint identifier."),
  technologyId: z.string().min(1, "Expected a technology identifier."),
  category: z.string().min(1, "Expected a category."),
  certainty: z.enum(["observed", "inferred"]),
  matchedIn: z.string().nullish(),
  matchedText: z.string().nullish(),
  version: z.string().nullish(),
  impliedBy: z.uuid().nullish(),
});

export type InsertTechnologyDetectionInput = z.input<typeof insertTechnologyDetectionInputSchema>;

/**
 * Inserts a technology detection, deriving company_id from the analysis.
 */
export async function insertTechnologyDetection(
  executor: Executor,
  input: InsertTechnologyDetectionInput,
): Promise<TechnologyDetectionRow> {
  const value = parseInput("The technology detection", insertTechnologyDetectionInputSchema, input);

  // Derive company_id from the analysis
  const [analysis] = await executor
    .select({ companyId: websiteAnalysis.companyId })
    .from(websiteAnalysis)
    .where(eq(websiteAnalysis.id, value.analysisId))
    .limit(1);

  if (analysis === undefined) {
    throw new Error(`Analysis not found: ${value.analysisId}`);
  }

  // Check if a detection already exists for this technology in this analysis
  const [existing] = await executor
    .select()
    .from(technologyDetections)
    .where(
      eq(technologyDetections.analysisId, value.analysisId) &&
        eq(technologyDetections.technologyId, value.technologyId),
    )
    .limit(1);

  if (existing !== undefined) {
    // Upgrade rule: inferred → observed is allowed, observed → inferred is not
    if (existing.certainty === "observed" && value.certainty === "inferred") {
      return existing;
    }

    // Update the existing detection
    const [updated] = await executor
      .update(technologyDetections)
      .set({
        certainty: value.certainty,
        matchedIn: value.matchedIn ?? null,
        matchedText: value.matchedText ?? null,
        version: value.version ?? null,
        impliedBy: value.impliedBy ?? null,
      })
      .where(eq(technologyDetections.id, existing.id))
      .returning();

    return updated!;
  }

  // Insert new detection
  const [row] = await executor
    .insert(technologyDetections)
    .values({
      id: uuidv7(),
      analysisId: value.analysisId,
      companyId: analysis.companyId,
      fingerprintId: value.fingerprintId,
      technologyId: value.technologyId,
      category: value.category,
      certainty: value.certainty,
      matchedIn: value.matchedIn ?? null,
      matchedText: value.matchedText ?? null,
      version: value.version ?? null,
      impliedBy: value.impliedBy ?? null,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The technology detection insert returned no row.");
  }

  return row;
}

/**
 * Returns the detections of a company's most recent completed analysis.
 */
export async function getLatestDetections(
  executor: Executor,
  companyId: string,
): Promise<readonly TechnologyDetectionRow[]> {
  // Find the latest completed analysis
  const [analysis] = await executor
    .select({ id: websiteAnalysis.id })
    .from(websiteAnalysis)
    .where(eq(websiteAnalysis.companyId, companyId) && eq(websiteAnalysis.outcome, "completed"))
    .orderBy(desc(websiteAnalysis.createdAt))
    .limit(1);

  if (analysis === undefined) {
    return [];
  }

  // Get all detections for that analysis
  return executor
    .select()
    .from(technologyDetections)
    .where(eq(technologyDetections.analysisId, analysis.id))
    .orderBy(technologyDetections.createdAt);
}

/**
 * Counts companies by a detected technology across the most recent completed
 * analysis of each company.
 */
export async function countCompaniesByTechnology(
  executor: Executor,
  technologyId: string,
): Promise<number> {
  const result = await executor
    .select({ count: technologyDetections.companyId })
    .from(technologyDetections)
    .where(eq(technologyDetections.technologyId, technologyId));

  // Count distinct company IDs
  const uniqueCompanies = new Set(result.map((r) => r.count));
  return uniqueCompanies.size;
}
