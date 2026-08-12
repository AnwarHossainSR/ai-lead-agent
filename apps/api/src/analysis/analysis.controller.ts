import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";

import { createZodDto } from "../validation/zod-dto";
import { AnalysisService } from "./analysis.service";

/**
 * Zod schema for the POST /api/companies/:id/analysis request body.
 */
const startAnalysisBodySchema = z.object({
  unverifiedOverride: z.boolean().default(false),
});

/**
 * DTO for the POST /api/companies/:id/analysis request body.
 */
export class StartAnalysisDto extends createZodDto(startAnalysisBodySchema) {}

/**
 * The analysis controller owns the API surface for website analysis.
 */
@Controller("companies")
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * POST /api/companies/:id/analysis — start an analysis.
   */
  @Post(":id/analysis")
  @HttpCode(HttpStatus.ACCEPTED)
  async startAnalysis(
    @Param("id") id: string,
    @Body() body: StartAnalysisDto,
  ): Promise<{
    readonly companyId: string;
    readonly status: string;
    readonly message: string;
  }> {
    const eligibility = await this.analysisService.checkEligibility(id);

    if (!eligibility.eligible) {
      throw new NotFoundException(eligibility.reason);
    }

    return {
      companyId: id,
      status: "accepted",
      message: "Analysis accepted for processing",
    };
  }

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
    const analysis = await this.analysisService.getLatestAnalysis(id);

    return {
      companyId: id,
      analyses: analysis ? [analysis] : [],
    };
  }
}
