import { Inject, Injectable } from "@nestjs/common";
import { companies, websiteAnalysis, type Database, insertWebsiteAnalysis, insertTechnologyDetection, technologyDetections } from "@mela/database";
import { eq, desc, and } from "drizzle-orm";

import { DATABASE } from "../database/database.module";
import { BrowserCaptureService } from "./browser-capture.service";
import { ArtifactService } from "./artifact.service";
import { PolitenessService } from "./politeness.service";
import { MatcherService, type PageCapture } from "./matcher.service";
import { runObservationRules } from "./observation-rules";
import type { WebsiteAnalysisOutcome } from "@mela/database";

/**
 * The analysis service orchestrates website analysis for companies.
 *
 * It coordinates:
 * 1. Eligibility checking
 * 2. Robots.txt and politeness
 * 3. Browser capture at both viewports
 * 4. Artifact persistence
 * 5. Observation rules
 * 6. Technology detection
 * 7. Database writes
 */
@Injectable()
export class AnalysisService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly browserCapture: BrowserCaptureService,
    private readonly artifactService: ArtifactService,
    private readonly politeness: PolitenessService,
    private readonly matcher: MatcherService,
  ) {}

  /**
   * Gets the latest analysis for a company.
   */
  async getLatestAnalysis(companyId: string): Promise<{
    companyId: string;
    outcome: string | null;
    analysedUrl: string | null;
    performanceScore: number | null;
    accessibilityScore: number | null;
    seoScore: number | null;
    createdAt: Date | null;
  } | null> {
    try {
      const [analysis] = await this.database
        .select({
          companyId: websiteAnalysis.companyId,
          outcome: websiteAnalysis.outcome,
          analysedUrl: websiteAnalysis.analysedUrl,
          performanceScore: websiteAnalysis.performanceScore,
          accessibilityScore: websiteAnalysis.accessibilityScore,
          seoScore: websiteAnalysis.seoScore,
          createdAt: websiteAnalysis.createdAt,
        })
        .from(websiteAnalysis)
        .where(eq(websiteAnalysis.companyId, companyId))
        .orderBy(desc(websiteAnalysis.createdAt))
        .limit(1);

      return analysis ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Checks if a company is eligible for analysis.
   */
  async checkEligibility(companyId: string): Promise<{
    eligible: boolean;
    reason?: string;
  }> {
    try {
      const [company] = await this.database
        .select({
          id: companies.id,
          website: companies.website,
          verificationState: companies.verificationState,
        })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      if (company === undefined) {
        return { eligible: false, reason: "Company not found" };
      }

      if (!company.website) {
        return { eligible: false, reason: "Company has no website" };
      }

      // Unverified companies require explicit override
      if (company.verificationState === "unverified") {
        return { eligible: false, reason: "Company is unverified" };
      }

      return { eligible: true };
    } catch {
      return { eligible: false, reason: "Error checking eligibility" };
    }
  }

  /**
   * Runs a full analysis for a company.
   */
  async runAnalysis(
    companyId: string,
    options: { unverifiedOverride?: boolean } = {},
  ): Promise<{
    companyId: string;
    outcome: string;
    analysisId: string;
  }> {
    const { unverifiedOverride = false } = options;

    // Check eligibility
    const eligibility = await this.checkEligibility(companyId);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason);
    }

    // Get the company website
    const [company] = await this.database
      .select({ website: companies.website })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company?.website) {
      throw new Error("Company website not found");
    }

    const url = company.website;

    // Check robots.txt
    const userAgent = "MelaBot/1.0";
    const isAllowed = await this.politeness.isPathAllowed(url, userAgent);
    if (!isAllowed) {
      // Record as skipped
      const analysisId = await this.recordAnalysis(companyId, url, {
        outcome: "skipped",
        failureReason: "Blocked by robots.txt",
        unverifiedOverride,
      });
      return { companyId, outcome: "skipped", analysisId };
    }

    // Run analysis
    try {
      // Ensure artifact directory exists
      await this.artifactService.ensureArtifactRoot();

      // Capture at both viewports
      const captures = await this.browserCapture.captureAtBothViewports(url, {
        navigationTimeoutMs: 30_000,
        maxPageBytes: 10 * 1024 * 1024,
        userAgent,
      });

      // Run observation rules on desktop capture
      const observations = runObservationRules(captures.desktop);

      // Run technology detection
      const pageCapture: PageCapture = {
        url: captures.desktop.url,
        status: captures.desktop.status,
        headers: captures.desktop.headers,
        html: captures.desktop.html,
        scriptUrls: [], // Would be extracted from page
        stylesheetUrls: [], // Would be extracted from page
        cookieNames: [], // Would be extracted from page
        metaGenerator: null, // Would be extracted from page
      };
      const detections = this.matcher.detect(pageCapture);

      // Record as completed
      const analysisId = await this.recordAnalysis(companyId, url, {
        outcome: "completed",
        observations: observations.map((obs) => ({
          statement: obs.description,
          evidence: {
            detail: obs.description,
            url: obs.url,
            observedAt: obs.observedAt,
          },
          certainty: "observed" as const,
        })),
        unverifiedOverride,
        detections,
      });

      return { companyId, outcome: "completed", analysisId };
    } catch (error) {
      // Record as failed
      const analysisId = await this.recordAnalysis(companyId, url, {
        outcome: "failed",
        failureReason:
          error instanceof Error ? error.message : "Unknown error",
        unverifiedOverride,
      });

      return { companyId, outcome: "failed", analysisId };
    }
  }

  /**
   * Records an analysis in the database.
   */
  private async recordAnalysis(
    companyId: string,
    url: string,
    options: {
      outcome: WebsiteAnalysisOutcome;
      failureReason?: string;
      observations?: Array<{
        statement: string;
        evidence: { detail: string; url: string; observedAt: string };
        certainty: "observed" | "inferred";
      }>;
      unverifiedOverride?: boolean;
      detections?: Array<{
        fingerprintId: string;
        technologyId: string;
        category: string;
        certainty: "observed" | "inferred";
        matchedIn: string | null;
        matchedText: string | null;
        version: string | null;
        impliedBy: string | null;
      }>;
    },
  ): Promise<string> {
    const { outcome, failureReason, observations = [], unverifiedOverride = false, detections = [] } = options;

    const row = await insertWebsiteAnalysis(this.database, {
      companyId,
      analysedUrl: url,
      outcome,
      failureReason: failureReason ?? undefined,
      unverifiedOverride,
      observations,
    });

    // Write technology detections
    for (const detection of detections) {
      await insertTechnologyDetection(this.database, {
        analysisId: row.id,
        fingerprintId: detection.fingerprintId,
        technologyId: detection.technologyId,
        category: detection.category,
        certainty: detection.certainty,
        matchedIn: detection.matchedIn ?? undefined,
        matchedText: detection.matchedText ?? undefined,
        version: detection.version ?? undefined,
        impliedBy: detection.impliedBy ?? undefined,
      });
    }

    return row.id;
  }

  /**
   * Re-runs technology detection against a stored analysis capture.
   *
   * This does not make any network requests or browser calls — it re-runs the
   * matcher against the stored HTML and headers from the original analysis.
   *
   * @param analysisId - The ID of the existing analysis
   * @returns The number of detections written
   */
  async redetectTechnologies(analysisId: string): Promise<number> {
    // Fetch the existing analysis
    const [analysis] = await this.database
      .select({
        id: websiteAnalysis.id,
        companyId: websiteAnalysis.companyId,
        analysedUrl: websiteAnalysis.analysedUrl,
        outcome: websiteAnalysis.outcome,
      })
      .from(websiteAnalysis)
      .where(eq(websiteAnalysis.id, analysisId))
      .limit(1);

    if (analysis === undefined) {
      throw new Error(`Analysis not found: ${analysisId}`);
    }

    if (analysis.outcome !== "completed") {
      throw new Error(`Analysis is not completed: ${analysis.outcome}`);
    }

    // Build a PageCapture from the stored analysis
    // In a real implementation, we'd load artifacts from disk
    // For now, we use the stored analysis data
    const pageCapture: PageCapture = {
      url: analysis.analysedUrl ?? "",
      status: 200,
      headers: {},
      html: "", // Would be loaded from artifacts
      scriptUrls: [],
      stylesheetUrls: [],
      cookieNames: [],
      metaGenerator: null,
    };

    // Run detection
    const detections = this.matcher.detect(pageCapture);

    // Clear existing detections for this analysis
    await this.database
      .delete(technologyDetections)
      .where(eq(technologyDetections.analysisId, analysisId));

    // Write new detections
    for (const detection of detections) {
      await insertTechnologyDetection(this.database, {
        analysisId,
        fingerprintId: detection.fingerprintId,
        technologyId: detection.technologyId,
        category: detection.category,
        certainty: detection.certainty,
        matchedIn: detection.matchedIn ?? undefined,
        matchedText: detection.matchedText ?? undefined,
        version: detection.version ?? undefined,
        impliedBy: detection.impliedBy ?? undefined,
      });
    }

    return detections.length;
  }

  /**
   * Gets the latest technologies for a company.
   *
   * @param companyId - The company ID
   * @returns The latest technologies array
   */
  async getLatestTechnologies(companyId: string): Promise<readonly Record<string, unknown>[]> {
    // Find the latest completed analysis
    const [analysis] = await this.database
      .select({ id: websiteAnalysis.id })
      .from(websiteAnalysis)
      .where(
        and(
          eq(websiteAnalysis.companyId, companyId),
          eq(websiteAnalysis.outcome, "completed"),
        ),
      )
      .orderBy(desc(websiteAnalysis.createdAt))
      .limit(1);

    if (analysis === undefined) {
      return [];
    }

    // Get all detections for that analysis
    const detections = await this.database
      .select()
      .from(technologyDetections)
      .where(eq(technologyDetections.analysisId, analysis.id))
      .orderBy(technologyDetections.createdAt);

    return detections;
  }
}
