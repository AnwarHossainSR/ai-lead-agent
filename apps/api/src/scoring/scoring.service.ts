import { Inject, Injectable } from "@nestjs/common";

import { type LeadPriority } from "@mela/config";
import {
  type Database,
  NoEvidenceForScoringError,
  assertEvidenceForScoring,
  gatherCompanyEvidence,
  identifyEvidence,
} from "@mela/database";
import { type LeadRow, insertLead, updateLeadScore } from "@mela/database";
import {
  compareSnapshots,
  insertLeadScoreSnapshot,
  leadScoreSnapshots,
  leads,
} from "@mela/database";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../database/database.module";
import { type ScoringInput, composeScores } from "./composer";
import { formatExplanation } from "./formatter";

export interface ScoreCompanyInput {
  readonly companyId: string;
  readonly weightVersion: number;
}

export interface ScoreCompanyResult {
  readonly leadId: string;
  readonly total: number;
  readonly priority: string;
  readonly isNewLead: boolean;
  readonly explanation: string;
}

export interface BatchScoreInput {
  readonly companyIds: readonly string[];
  readonly weightVersion: number;
}

export interface BatchScoreResult {
  readonly scored: number;
  readonly refused: number;
  readonly errored: number;
  readonly results: Array<{
    readonly companyId: string;
    readonly leadId?: string;
    readonly error?: string;
  }>;
}

export interface RecomputeResult {
  readonly leadId: string;
  readonly total: number;
  readonly priority: string;
  readonly explanation: string;
  readonly missingEvidence: readonly string[];
  readonly changedEvidence: readonly string[];
}

export interface ListLeadsOptions {
  readonly priority?: LeadPriority;
  readonly minScore?: number;
  readonly maxScore?: number;
  readonly limit?: number;
  readonly offset?: number;
}

@Injectable()
export class ScoringService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async scoreCompany(input: ScoreCompanyInput): Promise<ScoreCompanyResult> {
    const evidence = await gatherCompanyEvidence(this.database, input.companyId);
    assertEvidenceForScoring(evidence);

    const scoringInput: ScoringInput = {
      evidence,
      weightVersion: input.weightVersion,
    };

    const result = composeScores(scoringInput);
    const explanation = formatExplanation(result);
    const explanationText = explanation.summary;

    const componentScores = {
      business_fit: result.components.find((c) => c.componentId === "company_quality")!.value,
      technical_opportunity: result.components.find(
        (c) => c.componentId === "technical_opportunity",
      )!.value,
      business_opportunity: result.components.find((c) => c.componentId === "business_opportunity")!
        .value,
      decision_maker_found: result.components.find((c) => c.componentId === "decision_maker_found")!
        .value,
      company_quality: result.components.find((c) => c.componentId === "company_quality")!.value,
    };

    const existingLead = await this.database
      .select()
      .from(leads)
      .where(eq(leads.companyId, input.companyId))
      .limit(1);

    const lead = existingLead[0];

    if (lead === undefined) {
      const newLead = await insertLead(this.database, {
        companyId: input.companyId,
        scores: componentScores,
        scoreExplanation: explanationText,
        recommendedServiceId: null,
        contactReason: null,
        isExample: false,
      });

      await insertLeadScoreSnapshot(this.database, {
        leadId: newLead.id,
        companyId: input.companyId,
        scores: componentScores,
        total: result.total,
        priority: result.priority,
        explanation: explanationText,
        weightVersion: input.weightVersion,
        evidenceRefs: JSON.stringify(identifyEvidence(evidence)),
        missing: JSON.stringify(result.components.flatMap((c) => c.missing)),
      });

      return {
        leadId: newLead.id,
        total: result.total,
        priority: result.priority,
        isNewLead: true,
        explanation: explanationText,
      };
    }

    await updateLeadScore(this.database, {
      leadId: lead.id,
      scores: componentScores,
      explanation: explanationText,
      weightVersion: input.weightVersion,
      evidenceRefs: JSON.stringify(identifyEvidence(evidence)),
      missing: JSON.stringify(result.components.flatMap((c) => c.missing)),
    });

    await insertLeadScoreSnapshot(this.database, {
      leadId: lead.id,
      companyId: input.companyId,
      scores: componentScores,
      total: result.total,
      priority: result.priority,
      explanation: explanationText,
      weightVersion: input.weightVersion,
      evidenceRefs: JSON.stringify(identifyEvidence(evidence)),
      missing: JSON.stringify(result.components.flatMap((c) => c.missing)),
    });

    return {
      leadId: lead.id,
      total: result.total,
      priority: result.priority,
      isNewLead: false,
      explanation: explanationText,
    };
  }

  async batchScore(input: BatchScoreInput): Promise<BatchScoreResult> {
    const results: Array<{ companyId: string; leadId?: string; error?: string }> = [];
    let scored = 0;
    let refused = 0;
    let errored = 0;

    for (const companyId of input.companyIds) {
      try {
        const result = await this.scoreCompany({ companyId, weightVersion: input.weightVersion });
        results.push({ companyId, leadId: result.leadId });
        scored += 1;
      } catch (error) {
        if (error instanceof NoEvidenceForScoringError) {
          results.push({ companyId, error: error.message });
          refused += 1;
        } else {
          results.push({
            companyId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          errored += 1;
        }
      }
    }

    return { scored, refused, errored, results };
  }

  async recomputeScore(leadId: string): Promise<RecomputeResult> {
    const [lead] = await this.database.select().from(leads).where(eq(leads.id, leadId)).limit(1);

    if (lead === undefined) {
      throw new Error(`Lead ${leadId} not found.`);
    }

    const [latestSnapshot] = await this.database
      .select()
      .from(leadScoreSnapshots)
      .where(eq(leadScoreSnapshots.leadId, leadId))
      .orderBy(leadScoreSnapshots.createdAt)
      .limit(1);

    if (latestSnapshot === undefined) {
      throw new Error(`No snapshot found for lead ${leadId}.`);
    }

    const evidence = await gatherCompanyEvidence(this.database, lead.companyId);
    assertEvidenceForScoring(evidence);

    const currentIds = identifyEvidence(evidence);
    const recordedIds = JSON.parse(latestSnapshot.evidenceRefs) as {
      analysisId?: string;
      detectionIds?: string[];
      opportunityIds?: string[];
      contactIds?: string[];
    };

    const missingEvidence: string[] = [];
    const changedEvidence: string[] = [];

    if (!recordedIds.analysisId) missingEvidence.push("analysis");
    if (recordedIds.analysisId && recordedIds.analysisId !== currentIds.analysisId)
      changedEvidence.push("analysis");

    if (!recordedIds.detectionIds || recordedIds.detectionIds.length === 0)
      missingEvidence.push("detections");
    else if (JSON.stringify(recordedIds.detectionIds) !== JSON.stringify(currentIds.detectionIds))
      changedEvidence.push("detections");

    if (!recordedIds.opportunityIds || recordedIds.opportunityIds.length === 0)
      missingEvidence.push("opportunities");
    else if (
      JSON.stringify(recordedIds.opportunityIds) !== JSON.stringify(currentIds.opportunityIds)
    )
      changedEvidence.push("opportunities");

    if (!recordedIds.contactIds || recordedIds.contactIds.length === 0)
      missingEvidence.push("contacts");
    else if (JSON.stringify(recordedIds.contactIds) !== JSON.stringify(currentIds.contactIds))
      changedEvidence.push("contacts");

    const scoringInput: ScoringInput = {
      evidence,
      weightVersion: lead.weightVersion,
    };

    const result = composeScores(scoringInput);
    const explanation = formatExplanation(result);

    return {
      leadId,
      total: result.total,
      priority: result.priority,
      explanation: explanation.summary,
      missingEvidence,
      changedEvidence,
    };
  }

  async getScoreHistory(leadId: string) {
    const snapshots = await this.database
      .select()
      .from(leadScoreSnapshots)
      .where(eq(leadScoreSnapshots.leadId, leadId))
      .orderBy(leadScoreSnapshots.createdAt);

    const history: Array<{
      snapshot: typeof leadScoreSnapshots.$inferSelect;
      diff?: ReturnType<typeof compareSnapshots>;
    }> = [];

    for (let index = 0; index < snapshots.length; index += 1) {
      const current = snapshots[index]!;
      if (index > 0) {
        const previous = snapshots[index - 1]!;
        history.push({ snapshot: current, diff: compareSnapshots(previous, current) });
      } else {
        history.push({ snapshot: current });
      }
    }

    return history;
  }

  async listLeads(options: ListLeadsOptions = {}): Promise<LeadRow[]> {
    const conditions: ReturnType<typeof eq>[] = [];

    if (options.priority) {
      conditions.push(eq(leads.priority, options.priority));
    }

    if (options.minScore !== undefined) {
      conditions.push(eq(leads.leadScore, options.minScore));
    }

    let query = this.database.select().from(leads);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    query = query.orderBy(leads.leadScore) as any;

    if (options.limit) {
      query = query.limit(options.limit) as any;
    }

    if (options.offset) {
      query = query.offset(options.offset) as any;
    }

    return query as any;
  }
}
