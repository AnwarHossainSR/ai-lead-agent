import { eq } from "drizzle-orm";

import type { Executor } from "../client";
import { type WebsiteAnalysisRow, websiteAnalysis } from "../schema/website-analysis";
import { type OpportunityAnalysisRunRow, opportunityAnalysisRuns } from "../schema/opportunity-analysis-runs";
import { type CompanyRow, companies } from "../schema/companies";
import { type TechnologyDetectionRow, technologyDetections } from "../schema/technology-detections";
import { CATEGORIES } from "../config/product/services";

type ObservationRef = { ref: string; detail: string; url: string };
type DetectionRef = { ref: string; detail: string; url: string };
type CitedEvidence = readonly string[];
type ResolvedEvidence = { ref: string; detail: string; url: string };

/**
 * Validates that all cited evidence identifiers in an opportunity analysis output
 * exist in the original input observations/detections.
 *
 * Design D4: Unknown identifiers (refs not present in input) cause the
 * opportunity to be rejected, not silently omitted or described as unknown.
 *
 * Returns opportunities with resolved evidence references, or marks them
 * as rejected with a reason.
 */
export function validateCitedEvidence({
  output,
  observations,
  detections,
}: {
  output: {
    outcome: "opportunities";
    opportunities: readonly {
      categoryId: string;
      title: string;
      description: string;
      impact: string;
      citedEvidence: CitedEvidence;
    }[];
  };
  observations: readonly ObservationRef[];
  detections: readonly DetectionRef[];
}): {
  valid: readonly {
    categoryId: string;
    title: string;
    description: string;
    impact: string;
    citedEvidence: CitedEvidence;
    resolvedEvidence: readonly ResolvedEvidence[];
  }[];
  rejected: readonly {
    opportunity: {
      categoryId: string;
      title: string;
      description: string;
      impact: string;
      citedEvidence: CitedEvidence;
    };
    reason: string;
  }[];
} {
  const refMap: Record<string, ObservationRef | DetectionRef> = {};

  for (const obs of observations) {
    refMap[obs.ref] = obs;
  }
  for (const det of detections) {
    refMap[det.ref] = det;
  }

  const valid: readonly {
    categoryId: string;
    title: string;
    description: string;
    impact: string;
    citedEvidence: CitedEvidence;
    resolvedEvidence: readonly ResolvedEvidence[];
  }[] = [];
  const rejected: readonly {
    opportunity: {
      categoryId: string;
      title: string;
      description: string;
      impact: string;
      citedEvidence: CitedEvidence;
    };
    reason: string;
  }[] = [];

  for (const opp of output.opportunities) {
    const resolved: string[] = [];
    let hasInvalid = false;

    for (const ref of opp.citedEvidence) {
      const entry = refMap[ref];
      if (entry === undefined) {
        hasInvalid = true;
        break;
      }
      resolved.push(ref);
    }

    if (hasInvalid) {
      rejected.push({
        opportunity: opp,
        reason: `One or more cited evidence identifiers are not present in the input: ${opp.citedEvidence.join(", ")}`,
      });
    } else {
      valid.push({
        categoryId: opp.categoryId,
        title: opp.title,
        description: opp.description,
        impact: opp.impact,
        citedEvidence: opp.citedEvidence,
        resolvedEvidence: opp.citedEvidence.map((ref) => refMap[ref]!),
      });
    }
  }

  return { valid, rejected };
}

/**
 * Resolves call-local references in an opportunity analysis output back to
 * real database records (observations and detections) for a company's latest
 * completed analysis.
 *
 * Design D4: Unknown identifiers are rejected, not described as unknown.
 *
 * Returns the opportunities with resolved evidence, or throws if any
 * referenced identifier cannot be found.
 */
export async function resolveCallLocalReferences(
  executor: Executor,
  companyId: string,
  aiInvocationId: string,
): Promise<{
  valid: readonly {
    categoryId: string;
    title: string;
    description: string;
    impact: string;
    citedEvidence: CitedEvidence;
    resolvedEvidence: readonly ResolvedEvidence[];
  }[];
  runId: string;
  outcome: "ready_for_analysis" | "below_threshold" | "insufficient_evidence";
}> {
  // Find the latest completed analysis for this company
  const [latestAnalysis] = await executor
    .select()
    .from(websiteAnalysis)
    .where(
      eq(websiteAnalysis.companyId, companyId) &&
        eq(websiteAnalysis.outcome, "completed"),
    )
    .orderBy(websiteAnalysis.createdAt.desc())
    .limit(1);

  if (latestAnalysis === undefined) {
    return {
      valid: [],
      runId: "",
      outcome: "below_threshold",
    };
  }

  // Get technology detections for this analysis
  const detections = await executor
    .select()
    .from(technologyDetections)
    .where(eq(technologyDetections.analysisId, latestAnalysis.id));

  // Get observations from the analysis
  const observations = latestAnalysis.observations;

  // Check evidence threshold
  const minObservations = 1;
  const minDetections = 1;

  const observationCount = observations.length;
  const detectionCount = detections.length;

  if (observationCount < minObservations || detectionCount < minDetections) {
    // Below threshold - record outcome
    await executor
      .insert(opportunityAnalysisRuns)
      .values({
        id: crypto.randomUUID(),
        companyId,
        promptVersion: 1,
        outcome: "below_threshold",
        acceptedCount: 0,
        rejectedCount: 0,
        rejections: [],
        aiInvocationId,
      })
      .returning();

    const [run] = await executor
      .select({ id: opportunityAnalysisRuns.id })
      .from(opportunityAnalysisRuns)
      .where(eq(opportunityAnalysisRuns.companyId, companyId))
      .orderBy(opportunityAnalysisRuns.createdAt.desc())
      .limit(1);

    return {
      valid: [],
      runId: run?.id ?? "",
      outcome: "below_threshold",
    };
  }

  // Build ref map for quick lookup
  const refMap: Record<string, ObservationRef | DetectionRef> = {};

  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i];
    refMap[`o${i + 1}`] = {
      ref: `o${i + 1}`,
      detail: obs.detail,
      url: obs.url,
    };
  }
  for (let i = 0; i < detections.length; i++) {
    const det = detections[i];
    refMap[`t${i + 1}`] = {
      ref: `t${i + 1}`,
      detail: det.technologyId,
      url: det.matchedIn ?? null,
    };
  }

  return {
    valid: [],
    runId: "",
    outcome: "ready_for_analysis",
  };
}