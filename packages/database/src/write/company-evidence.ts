import { desc, eq } from "drizzle-orm";

import type { Executor } from "../client";
import { type CompanyRow, companies } from "../schema/companies";
import type { ContactRow } from "../schema/contacts";
import { type OpportunityRow, opportunities } from "../schema/opportunities";
import { opportunityAnalysisRuns } from "../schema/opportunity-analysis-runs";
import { type TechnologyDetectionRow, technologyDetections } from "../schema/technology-detections";
import { type WebsiteAnalysisRow, websiteAnalysis } from "../schema/website-analysis";
import { getLatestContacts } from "./contacts";

/**
 * All the evidence needed to score a company, assembled in one read.
 *
 * The identifiers let a snapshot record exactly what it used, so a later
 * rescore can detect when the underlying evidence has changed.
 */
export interface CompanyEvidence {
  readonly companyId: string;
  readonly analysis: WebsiteAnalysisRow | undefined;
  readonly detections: readonly TechnologyDetectionRow[];
  readonly opportunities: readonly OpportunityRow[];
  readonly contacts: readonly ContactRow[];
  readonly company: CompanyRow;
}

export interface CompanyEvidenceIdentifiers {
  readonly companyId: string;
  readonly analysisId: string | undefined;
  readonly analysisCreatedAt: string | undefined;
  readonly detectionIds: readonly string[];
  readonly opportunityIds: readonly string[];
  readonly contactIds: readonly string[];
}

export class NoEvidenceForScoringError extends Error {
  constructor(
    readonly companyId: string,
    readonly reason: string,
  ) {
    super(`Cannot score company ${companyId}: ${reason}`);
    this.name = "NoEvidenceForScoringError";
  }
}

export function assertEvidenceForScoring(evidence: CompanyEvidence): void {
  const hasAnyEvidence =
    evidence.analysis !== undefined ||
    evidence.detections.length > 0 ||
    evidence.opportunities.length > 0 ||
    evidence.contacts.length > 0;

  if (!hasAnyEvidence) {
    throw new NoEvidenceForScoringError(
      evidence.companyId,
      "No website analysis, technology detections, opportunities, or contacts have been gathered for this company.",
    );
  }
}

/**
 * Assembles the evidence for a company's most recent completed analysis,
 * its detections, current opportunities, contacts and company attributes.
 */
export async function gatherCompanyEvidence(
  executor: Executor,
  companyId: string,
): Promise<CompanyEvidence> {
  const company = await executor
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .then((rows) => rows[0]);

  if (company === undefined) {
    throw new Error(`Company ${companyId} not found.`);
  }

  const analysis = await getLatestCompletedAnalysis(executor, companyId);
  const detections = analysis ? await getDetectionsForAnalysis(executor, analysis.id) : [];
  const opportunities = await getCurrentOpportunities(executor, companyId);
  const companyContacts = await getLatestContacts(executor, companyId);

  return {
    companyId,
    analysis,
    detections,
    opportunities,
    contacts: companyContacts,
    company,
  };
}

export function identifyEvidence(evidence: CompanyEvidence): CompanyEvidenceIdentifiers {
  return {
    companyId: evidence.companyId,
    analysisId: evidence.analysis?.id,
    analysisCreatedAt: evidence.analysis?.createdAt.toISOString(),
    detectionIds: evidence.detections.map((d) => d.id),
    opportunityIds: evidence.opportunities.map((o) => o.id),
    contactIds: evidence.contacts.map((c) => c.id),
  };
}

async function getLatestCompletedAnalysis(
  executor: Executor,
  companyId: string,
): Promise<WebsiteAnalysisRow | undefined> {
  const [row] = await executor
    .select()
    .from(websiteAnalysis)
    .where(eq(websiteAnalysis.companyId, companyId) && eq(websiteAnalysis.outcome, "completed"))
    .orderBy(desc(websiteAnalysis.createdAt), desc(websiteAnalysis.id))
    .limit(1);

  return row;
}

async function getDetectionsForAnalysis(
  executor: Executor,
  analysisId: string,
): Promise<readonly TechnologyDetectionRow[]> {
  return executor
    .select()
    .from(technologyDetections)
    .where(eq(technologyDetections.analysisId, analysisId))
    .orderBy(technologyDetections.createdAt);
}

async function getCurrentOpportunities(
  executor: Executor,
  companyId: string,
): Promise<readonly OpportunityRow[]> {
  const runs = await executor
    .select()
    .from(opportunityAnalysisRuns)
    .where(eq(opportunityAnalysisRuns.companyId, companyId))
    .orderBy(desc(opportunityAnalysisRuns.createdAt));

  const successfulRun = runs.find((run) => run.outcome === "opportunities");

  if (successfulRun === undefined) {
    return [];
  }

  return executor
    .select()
    .from(opportunities)
    .where(eq(opportunities.runId, successfulRun.id))
    .orderBy(opportunities.createdAt);
}
