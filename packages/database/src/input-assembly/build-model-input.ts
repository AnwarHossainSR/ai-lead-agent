import { CATEGORIES, DEFAULT_THRESHOLD } from "@mela/config";
import { desc, eq } from "drizzle-orm";
import type { Executor } from "../client";
import { companies } from "../schema/companies";
import { opportunityAnalysisRuns } from "../schema/opportunity-analysis-runs";
import { technologyDetections } from "../schema/technology-detections";
import { websiteAnalysis } from "../schema/website-analysis";
import { insertOpportunityAnalysisRun } from "../write/opportunity-analysis-runs";

type ObservationRef = { ref: string; detail: string; url: string };
type DetectionRef = { ref: string; detail: string; url: string };

/**
 * Returns the latest completed analysis for a company, or undefined if none exists.
 */
async function getLatestAnalysis(executor: Executor, companyId: string) {
  return executor
    .select()
    .from(websiteAnalysis)
    .where(eq(websiteAnalysis.companyId, companyId) && eq(websiteAnalysis.outcome, "completed"))
    .orderBy(desc(websiteAnalysis.createdAt))
    .limit(1)
    .then((rows) => rows[0]);
}

/**
 * Returns technology detections for an analysis.
 */
async function getDetections(executor: Executor, analysisId: string) {
  return executor
    .select()
    .from(technologyDetections)
    .where(eq(technologyDetections.analysisId, analysisId));
}

/**
 * Returns observations from an analysis as typed objects.
 */
function getObservations(analysis: { observations: unknown }) {
  return analysis.observations as readonly {
    statement: string;
    evidence: { detail: string; url: string; observedAt: string };
    certainty: "observed" | "inferred";
  }[];
}

/**
 * Returns the service catalogue from configuration.
 */
function getServiceCatalogue() {
  return CATEGORIES.map((cat) => ({
    id: cat.id,
    name: cat.name,
  }));
}

/**
 * Records a below-threshold outcome for a company.
 */
async function recordBelowThreshold(
  executor: Executor,
  companyId: string,
  aiInvocationId: string | null,
): Promise<string> {
  const run = await insertOpportunityAnalysisRun(executor, {
    companyId,
    promptVersion: 1,
    outcome: "below_threshold",
    acceptedCount: 0,
    rejectedCount: 0,
    rejections: [],
    aiInvocationId: aiInvocationId ?? undefined,
  });
  return run.id;
}

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
  aiInvocationId: string | null,
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
  const analysis = await getLatestAnalysis(executor, companyId);

  if (analysis === undefined) {
    const runId = await recordBelowThreshold(executor, companyId, aiInvocationId);
    return { outcome: "below_threshold", runId };
  }

  const [company] = await executor
    .select({ industryId: companies.industryId, countryId: companies.countryId })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  const industry = company?.industryId ?? "";
  const country = company?.countryId ?? "";

  const detections = await getDetections(executor, analysis.id);
  const rawObservations = getObservations(analysis);
  const serviceCatalogue = getServiceCatalogue();

  const threshold = DEFAULT_THRESHOLD;
  const minObservations = threshold.minimumObservations;
  const minDetections = threshold.minimumDetections;

  if (rawObservations.length < minObservations || detections.length < minDetections) {
    const runId = await recordBelowThreshold(executor, companyId, aiInvocationId);
    return { outcome: "below_threshold", runId };
  }

  const observationRefs = rawObservations.map((obs, index) => ({
    ref: `o${index + 1}`,
    detail: obs.evidence.detail,
    url: obs.evidence.url,
  }));

  const detectionRefs = detections.map((det, index) => ({
    ref: `t${index + 1}`,
    detail: det.technologyId,
    url: det.matchedIn ?? "",
  }));

  const input = {
    industry,
    country,
    observations: observationRefs as readonly ObservationRef[],
    detections: detectionRefs as readonly DetectionRef[],
    serviceCatalogue,
  };

  const [latestRun] = await executor
    .select({ id: opportunityAnalysisRuns.id })
    .from(opportunityAnalysisRuns)
    .where(eq(opportunityAnalysisRuns.companyId, companyId))
    .orderBy(desc(opportunityAnalysisRuns.createdAt))
    .limit(1);

  return {
    outcome: "ready_for_analysis",
    input,
    runId: latestRun?.id,
  };
}
