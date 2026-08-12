import {
  Controller,
  NotFoundException,
  Param,
} from "@nestjs/common";

import { AnalysisService } from "./analysis.service";

/**
 * The analysis controller owns the API surface for website analysis.
 */
@Controller("companies")
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * GET /api/companies/:id/analysis/latest — get the latest analysis.
   */
  async getLatestAnalysis(
    @Param("id") id: string,
  ): Promise<{
    readonly companyId: string;
    readonly outcome: string | null;
    readonly analysedUrl: string | null;
    readonly performanceScore: number | null;
    readonly accessibilityScore: number | null;
    readonly seoScore: number | null;
    readonly createdAt: string | null;
  }> {
    const analysis = await this.analysisService.getLatestAnalysis(id);

    if (analysis === null) {
      throw new NotFoundException(`No analysis found for company "${id}".`);
    }

    return {
      companyId: analysis.companyId,
      outcome: analysis.outcome,
      analysedUrl: analysis.analysedUrl,
      performanceScore: analysis.performanceScore,
      accessibilityScore: analysis.accessibilityScore,
      seoScore: analysis.seoScore,
      createdAt: analysis.createdAt?.toISOString() ?? null,
    };
  }

  /**
   * GET /api/companies/:id/analysis — list all analyses for a company.
   */
  async listAnalyses(
    @Param("id") id: string,
  ): Promise<{
    readonly companyId: string;
    readonly analyses: readonly Record<string, unknown>[];
  }> {
    // For now, return the latest analysis
    const analysis = await this.analysisService.getLatestAnalysis(id);

    return {
      companyId: id,
      analyses: analysis ? [analysis] : [],
    };
  }
}
