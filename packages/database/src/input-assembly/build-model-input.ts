import { eq } from "drizzle-orm";

import type { Executor } from "../client";
import { type WebsiteAnalysisRow, websiteAnalysis } from "../schema/website-analysis";
import { type OpportunityAnalysisRunRow, opportunityAnalysisRuns } from "../schema/opportunity-analysis-runs";
import { type OpportunityRow, opportunities } from "../schema/opportunities";
import { type CompanyRow, companies } from "../schema/companies";
import { type TechnologyDetectionRow, technologyDetections } from "../schema/technology-detections";
import { insertOpportunityAnalysisRun } from "./opportunity-analysis-runs";
import { opportunityThreshold } from "../config/product/opportunity-threshold";
import { CATEGORIES } from "../config/product/services";

type ObservationRef = { ref: string; detail: string; url: string };
type DetectionRef = { ref: string; detail: string; url: string };

/**
 * Builds the model input from a company's latest completed analysis.
 * Returns the input for the opportunity analysis prompt, or records a
 * below-threshold outcome if the company does not have enough evidence.
 *
 * Design D4: Unknown attributes are omitted, not described as unknown.
 * Design D3: Threshold check happens before the model call.
 */
export async function buildModelInput(
  executor: Executor,
  companyId: string,
  aiInvocationId: string
): Promise<{
  outcome: "below_threshold" | "ready_for_analysis";
  input?: {
    industry: string;
    country: string;
    observations: readonly ObservationRef[];
    detections: readonly DetectionRef[];
    serviceCatalogue: readonly { id: string; name: string }[];
  };
  runId?: string;
}> {
  // Find the latest completed analysis for this company
  const [latestAnalysis] = await executor
    .select()
    .from(websiteAnalysis)
    .where(
      eq(websiteAnalysis.companyId, companyId) &&
        eq(websiteAnalysis.outcome, "completed")
    )
    .orderBy(websiteAnalysis.createdAt.desc())
    .limit(1);

  if (latestAnalysis === undefined) {
    // No analysis exists yet - this would be handled earlier in the pipeline
    return { outcome: "ready_for_analysis" };
  }

  // Get technology detections for this analysis
  const detections = await executor
    .select()
    .from(technologyDetections)
    .where(eq(technologyDetections.analysisId, latestAnalysis.id));

  // Get observations from the analysis (validated against evidence schema)
  const observations = latestAnalysis.observations;

  // Get the service catalogue from configuration
  const serviceCatalogue = CATEGORIES.map((cat) => ({
    id: cat.id,
    name: cat.name,
  }));

  // Check evidence threshold
  const minObservations = opportunityThreshold.minimumObservations;
  const minDetections = opportunityThreshold.minimumDetections;

  const observationCount = observations.length;
  const detectionCount = detections.length;

  if (observationCount < minObservations || detectionCount < minDetections) {
    // Below threshold - record outcome and make no model call
    await insertOpportunityAnalysisRun(executor, {
      companyId,
      promptVersion: 1,
      outcome: "below_threshold",
      acceptedCount: 0,
      rejectedCount: 0,
      rejections: [],
      aiInvocationId,
    });

    return { outcome: "below_threshold" };
  }

  // Build call-local references
  // Observations get identifiers o1, o2, …
  const observationRefs = observations.map((obs, index) => ({
    ref: `o${index + 1}`,
    detail: obs.detail,
    url: obs.url,
  }));

  // Detections get identifiers t1, t2, …
  const detectionRefs = detections.map((det, index) => ({
    ref: `t${index + 1}`,
    detail: det.technologyId,
    url: det.matchedIn ?? null,
  }));

  // Build the model input
  const input = {
    industry: latestAnalysis.industryId ?? "",
    country: latestAnalysis.countryId,
    observations: observationRefs as readonly ObservationRef[],
    detections: detectionRefs as readonly DetectionRef[],
    serviceCatalogue,
  };

  // Find or create the opportunity analysis run
  const run = await executor
    .select({ id: opportunityAnalysisRuns.id })
    .from(opportunityAnalysisRuns)
    .where(eq(opportunityAnalysisRuns.companyId, companyId))
    .orderBy(opportunityAnalysisRuns.createdAt.desc())
    .limit(1);

  const runId = run[0]?.id;

  return {
    outcome: "ready_for_analysis",
    input,
    runId: runId ?? undefined,
  };
}