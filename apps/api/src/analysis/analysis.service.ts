import { Inject, Injectable } from "@nestjs/common";
import { companies, websiteAnalysis } from "@mela/database";
import { eq, desc } from "drizzle-orm";

import { DATABASE } from "../database/database.module";
import { type Database } from "@mela/database";

/**
 * The analysis service orchestrates website analysis for companies.
 *
 * For now, this is a stub that records the analysis intent.
 * The full implementation with Playwright and Lighthouse will be added
 * in the browser and capture groups.
 */
@Injectable()
export class AnalysisService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

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
}
