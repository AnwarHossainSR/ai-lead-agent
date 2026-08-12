import { type AIResult, AIService } from "@mela/ai";
import { type Executor } from "@mela/database";
import {
  buildModelInput,
  insertOpportunity,
  insertOpportunityAnalysisRun,
  validateCitedEvidence,
} from "@mela/database";

/**
 * Input for an opportunity analysis run.
 */
export interface OpportunityAnalysisRequest {
  readonly companyId: string;
}

/**
 * Outcome of an opportunity analysis run.
 */
export interface OpportunityAnalysisResult {
  readonly runId: string;
  readonly outcome: "opportunities" | "insufficient_evidence" | "below_threshold" | "failed";
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly opportunities: readonly Opportunity[];
}

/**
 * A single identified opportunity.
 */
export interface Opportunity {
  readonly id: string;
  readonly categoryId: string;
  readonly title: string;
  readonly description: string;
  readonly impact: string;
  readonly citedEvidence: readonly string[];
}

/**
 * The opportunity analysis service orchestrates AI-powered opportunity
 * identification for companies (design D3/D4).
 *
 * 1. Builds model input from the company's latest website analysis
 * 2. Records below-threshold outcome if insufficient evidence
 * 3. Calls the AI model to identify opportunities
 * 4. Validates cited evidence against the original input
 * 5. Stores accepted opportunities and rejects invalid ones
 */
export class OpportunityAnalysisService {
  constructor(private readonly aiService: AIService) {}

  /**
   * Runs an opportunity analysis for a company.
   */
  async analyze(
    executor: Executor,
    request: OpportunityAnalysisRequest,
  ): Promise<OpportunityAnalysisResult> {
    // Step 1: Build model input (records below_threshold if needed)
    const modelInputResult = await buildModelInput(executor, request.companyId, null);

    if (modelInputResult.outcome === "below_threshold") {
      return {
        runId: modelInputResult.runId ?? "",
        outcome: "below_threshold",
        acceptedCount: 0,
        rejectedCount: 0,
        opportunities: [],
      };
    }

    if (modelInputResult.input === undefined) {
      return {
        runId: "",
        outcome: "failed",
        acceptedCount: 0,
        rejectedCount: 0,
        opportunities: [],
      };
    }

    // Step 2: Call the AI model
    const aiResult: AIResult<{
      outcome: "opportunities" | "insufficient_evidence";
      opportunities?: readonly {
        categoryId: string;
        title: string;
        description: string;
        impact: string;
        citedEvidence: readonly string[];
      }[];
      reason?: string;
    }> = await this.aiService.run("opportunity-analysis", 1, modelInputResult.input);

    // Step 3: Validate the output
    const validation = validateCitedEvidence({
      output: {
        outcome: "opportunities",
        opportunities: aiResult.value.opportunities ?? [],
      },
      observations: modelInputResult.input.observations,
      detections: modelInputResult.input.detections,
    });

    // Step 4: Record the analysis run
    const run = await insertOpportunityAnalysisRun(executor, {
      companyId: request.companyId,
      promptVersion: 1,
      outcome: validation.valid.length > 0 ? "opportunities" : "insufficient_evidence",
      acceptedCount: validation.valid.length,
      rejectedCount: validation.rejected.length,
      rejections: validation.rejected.map((r) => ({
        reason: r.reason,
        count: 1,
      })),
      aiInvocationId: aiResult.invocationId,
    });

    // Step 5: Store accepted opportunities
    const storedOpportunities: Opportunity[] = [];

    for (const opp of validation.valid) {
      const stored = await insertOpportunity(executor, {
        analysisRunId: run.id,
        companyId: request.companyId,
        categoryId: opp.categoryId,
        serviceId: opp.categoryId,
        title: opp.title,
        description: opp.description,
        impact: opp.impact,
        citedEvidence: [...opp.citedEvidence],
        aiInvocationId: aiResult.invocationId,
      });

      storedOpportunities.push({
        id: stored.id,
        categoryId: opp.categoryId,
        title: opp.title,
        description: opp.description,
        impact: opp.impact,
        citedEvidence: opp.citedEvidence,
      });
    }

    return {
      runId: run.id,
      outcome: validation.valid.length > 0 ? "opportunities" : "insufficient_evidence",
      acceptedCount: validation.valid.length,
      rejectedCount: validation.rejected.length,
      opportunities: storedOpportunities,
    };
  }
}
