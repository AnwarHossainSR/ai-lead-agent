import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DATABASE } from "../database/database.module";
import { type Database } from "@mela/database";
import { opportunityAnalysisRuns, opportunities, companies } from "@mela/database";

import { OpportunityAnalysisService } from "./opportunity-analysis.service";

/**
 * DTO for POST /api/opportunity/analysis/:companyId request body.
 */
export class AnalyzeOpportunitiesDto {}

/**
 * The opportunity analysis controller owns the API surface for opportunity
 * analysis (design D6). It exposes endpoints to trigger and inspect analysis
 * runs.
 */
@Controller("opportunity/analysis")
export class OpportunityAnalysisController {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly opportunityAnalysisService: OpportunityAnalysisService,
  ) {}

  /**
   * POST /api/opportunity/analysis/:companyId — run opportunity analysis.
   */
  @Post(":companyId")
  @HttpCode(HttpStatus.OK)
  async analyze(
    @Param("companyId") companyId: string,
  ): Promise<{
    readonly run: Record<string, unknown>;
    readonly opportunities: readonly Record<string, unknown>[];
  }> {
    const [company] = await this.database
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (company === undefined) {
      throw new NotFoundException(`Company "${companyId}" not found.`);
    }

    const result = await this.opportunityAnalysisService.analyze(
      this.database,
      { companyId },
    );

    if (!result.runId) {
      throw new NotFoundException(`Opportunity analysis run not found for company "${companyId}".`);
    }

    const [run] = await this.database
      .select()
      .from(opportunityAnalysisRuns)
      .where(eq(opportunityAnalysisRuns.id, result.runId))
      .limit(1);

    if (run === undefined) {
      throw new NotFoundException(`Opportunity analysis run "${result.runId}" not found.`);
    }

    const storedOpportunities = await this.database
      .select()
      .from(opportunities)
      .where(eq(opportunities.runId, result.runId));

    return {
      run: run as unknown as Record<string, unknown>,
      opportunities: storedOpportunities as unknown as readonly Record<string, unknown>[],
    };
  }
}
