import { desc, eq } from "drizzle-orm";

import type { Executor } from "../client";
import { type OpportunityRow, opportunities } from "../schema/opportunities";
import {
  type OpportunityAnalysisRunRow,
  opportunityAnalysisRuns,
} from "../schema/opportunity-analysis-runs";

/**
 * Returns the opportunities of a company's most recent completed analysis.
 */
export async function getLatestOpportunities(
  executor: Executor,
  companyId: string,
): Promise<readonly OpportunityRow[]> {
  // Find the latest completed analysis
  const [analysis] = await executor
    .select({ id: opportunityAnalysisRuns.id })
    .from(opportunityAnalysisRuns)
    .where(
      eq(opportunityAnalysisRuns.companyId, companyId) &&
        eq(opportunityAnalysisRuns.outcome, "opportunities"),
    )
    .orderBy(desc(opportunityAnalysisRuns.createdAt))
    .limit(1);

  if (analysis === undefined) {
    return [];
  }

  // Get all opportunities for that analysis
  return executor
    .select()
    .from(opportunities)
    .where(eq(opportunities.runId, analysis.id))
    .orderBy(opportunities.createdAt);
}

/**
 * Returns the run history for a company.
 */
export async function getRunHistory(
  executor: Executor,
  companyId: string,
): Promise<readonly OpportunityAnalysisRunRow[]> {
  return executor
    .select()
    .from(opportunityAnalysisRuns)
    .where(eq(opportunityAnalysisRuns.companyId, companyId))
    .orderBy(desc(opportunityAnalysisRuns.createdAt));
}

/**
 * Returns the current opportunities for a company (latest successful run).
 */
export async function getCurrentOpportunities(
  executor: Executor,
  companyId: string,
): Promise<readonly OpportunityRow[]> {
  const runs = await getRunHistory(executor, companyId);

  if (runs.length === 0) {
    return [];
  }

  // Find the first successful run (outcome = "opportunities")
  const successfulRun = runs.find((run) => run.outcome === "opportunities");

  if (successfulRun === undefined) {
    return [];
  }

  return getLatestOpportunities(executor, companyId);
}
