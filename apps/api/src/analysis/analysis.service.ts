import { Inject, Injectable } from "@nestjs/common";
import { companies, websiteAnalysis, type Database, insertWebsiteAnalysis } from "@mela/database";
import { eq, desc } from "drizzle-orm";

import { DATABASE } from "../database/database.module";
import { BrowserCaptureService } from "./browser-capture.service";
import { ArtifactService } from "./artifact.service";
import { PolitenessService } from "./politeness.service";
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
 * 6. Database writes
 */
@Injectable()
export class AnalysisService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly browserCapture: BrowserCaptureService,
    private readonly artifactService: ArtifactService,
    private readonly politeness: PolitenessService,
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
    },
  ): Promise<string> {
    const { outcome, failureReason, observations = [], unverifiedOverride = false } = options;

    const row = await insertWebsiteAnalysis(this.database, {
      companyId,
      analysedUrl: url,
      outcome,
      failureReason: failureReason ?? undefined,
      unverifiedOverride,
      observations,
    });

    return row.id;
  }
}
