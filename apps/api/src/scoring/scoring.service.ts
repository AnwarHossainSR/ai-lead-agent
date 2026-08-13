import { Inject, Injectable } from "@nestjs/common";

import type { LeadPriority, LeadStatus } from "@mela/config";
import { TERMINAL_LEAD_STATUSES } from "@mela/config";
import {
  type Database,
  NoEvidenceForScoringError,
  assertEvidenceForScoring,
  companies,
  gatherCompanyEvidence,
  identifyEvidence,
} from "@mela/database";
import { insertLead, updateLeadScore } from "@mela/database";
import {
  compareSnapshots,
  insertLeadScoreSnapshot,
  leadScoreSnapshots,
  leads,
} from "@mela/database";
import { type SQL, and, asc, count, desc, eq, gte, lt, lte, notInArray } from "drizzle-orm";
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
  readonly status?: LeadStatus;
  readonly industryId?: string;
  readonly cityId?: string;
  readonly serviceId?: string;
  readonly minScore?: number;
  readonly maxScore?: number;
  /** A lead is stale once its score is older than this many days. */
  readonly staleAfterDays?: number;
  /** When set, keeps only stale (`true`) or only fresh (`false`) leads. */
  readonly stale?: boolean;
  /** When true, excludes leads whose status is terminal (design lead-lifecycle). */
  readonly active?: boolean;
  readonly order?: "score_asc" | "score_desc";
  readonly limit?: number;
  readonly offset?: number;
}

export interface CountLeadsOptions {
  readonly priority?: LeadPriority;
  readonly status?: LeadStatus;
  readonly industryId?: string;
  readonly cityId?: string;
  readonly serviceId?: string;
  readonly minScore?: number;
  readonly maxScore?: number;
  readonly staleAfterDays?: number;
  readonly stale?: boolean;
  readonly active?: boolean;
}

/** A lead row joined with the company context the lead list views need. */
export interface ListedLead {
  readonly id: string;
  readonly companyId: string;
  readonly companyName: string;
  readonly industryId: string;
  readonly cityId: string | null;
  readonly leadScore: number;
  readonly priority: string;
  readonly status: string;
  readonly businessFitScore: number;
  readonly technicalOpportunityScore: number;
  readonly businessOpportunityScore: number;
  readonly decisionMakerFoundScore: number;
  readonly companyQualityScore: number;
  readonly scoreExplanation: string;
  readonly recommendedServiceId: string | null;
  readonly contactReason: string | null;
  readonly scoredAt: Date;
  readonly isStale: boolean;
}

const DEFAULT_STALE_AFTER_DAYS = 30;

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

  /** Shared by listLeads and countLeads, so the two never disagree about what a filter means. */
  private buildLeadConditions(options: ListLeadsOptions | CountLeadsOptions): {
    conditions: SQL[];
    staleCutoff: Date;
  } {
    const conditions: SQL[] = [];

    if (options.priority) {
      conditions.push(eq(leads.priority, options.priority));
    }
    if (options.status) {
      conditions.push(eq(leads.status, options.status));
    }
    if (options.industryId) {
      conditions.push(eq(companies.industryId, options.industryId));
    }
    if (options.cityId) {
      conditions.push(eq(companies.cityId, options.cityId));
    }
    if (options.serviceId) {
      conditions.push(eq(leads.recommendedServiceId, options.serviceId));
    }
    if (options.minScore !== undefined) {
      conditions.push(gte(leads.leadScore, options.minScore));
    }
    if (options.maxScore !== undefined) {
      conditions.push(lte(leads.leadScore, options.maxScore));
    }
    if (options.active === true) {
      conditions.push(notInArray(leads.status, [...TERMINAL_LEAD_STATUSES]));
    }

    const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
    const staleCutoff = new Date(Date.now() - staleAfterDays * 24 * 60 * 60 * 1000);

    if (options.stale === true) {
      conditions.push(lt(leads.scoredAt, staleCutoff));
    } else if (options.stale === false) {
      conditions.push(gte(leads.scoredAt, staleCutoff));
    }

    return { conditions, staleCutoff };
  }

  async countLeads(options: CountLeadsOptions = {}): Promise<number> {
    const { conditions } = this.buildLeadConditions(options);

    const [row] = await this.database
      .select({ value: count() })
      .from(leads)
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return row?.value ?? 0;
  }

  async listLeads(options: ListLeadsOptions = {}): Promise<ListedLead[]> {
    const { conditions, staleCutoff } = this.buildLeadConditions(options);

    const orderColumn =
      options.order === "score_asc" ? asc(leads.leadScore) : desc(leads.leadScore);

    const rows = await this.database
      .select({
        id: leads.id,
        companyId: leads.companyId,
        companyName: companies.name,
        industryId: companies.industryId,
        cityId: companies.cityId,
        leadScore: leads.leadScore,
        priority: leads.priority,
        status: leads.status,
        businessFitScore: leads.businessFitScore,
        technicalOpportunityScore: leads.technicalOpportunityScore,
        businessOpportunityScore: leads.businessOpportunityScore,
        decisionMakerFoundScore: leads.decisionMakerFoundScore,
        companyQualityScore: leads.companyQualityScore,
        scoreExplanation: leads.scoreExplanation,
        recommendedServiceId: leads.recommendedServiceId,
        contactReason: leads.contactReason,
        scoredAt: leads.scoredAt,
      })
      .from(leads)
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderColumn)
      .limit(options.limit ?? 50)
      .offset(options.offset ?? 0);

    return rows.map((row) => ({
      ...row,
      isStale: row.scoredAt < staleCutoff,
    }));
  }

  /**
   * A single lead with its company context, for the lead detail view. Uses
   * the same default staleness window as `listLeads` and `countLeads`, so
   * "stale" means the same thing everywhere it appears.
   */
  async getLead(leadId: string): Promise<LeadDetail | null> {
    const [row] = await this.database
      .select({
        id: leads.id,
        companyId: leads.companyId,
        leadScore: leads.leadScore,
        priority: leads.priority,
        status: leads.status,
        businessFitScore: leads.businessFitScore,
        technicalOpportunityScore: leads.technicalOpportunityScore,
        businessOpportunityScore: leads.businessOpportunityScore,
        decisionMakerFoundScore: leads.decisionMakerFoundScore,
        companyQualityScore: leads.companyQualityScore,
        scoreExplanation: leads.scoreExplanation,
        recommendedServiceId: leads.recommendedServiceId,
        contactReason: leads.contactReason,
        scoredAt: leads.scoredAt,
        company: {
          id: companies.id,
          name: companies.name,
          industryId: companies.industryId,
          cityId: companies.cityId,
          countryId: companies.countryId,
          website: companies.website,
          verificationState: companies.verificationState,
          discoverySource: companies.discoverySource,
          discoverySourceUrl: companies.discoverySourceUrl,
          doNotContactAt: companies.doNotContactAt,
          doNotContactReason: companies.doNotContactReason,
        },
      })
      .from(leads)
      .innerJoin(companies, eq(leads.companyId, companies.id))
      .where(eq(leads.id, leadId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    const staleCutoff = new Date(Date.now() - DEFAULT_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);

    return { ...row, isStale: row.scoredAt < staleCutoff };
  }
}

export interface LeadDetail {
  readonly id: string;
  readonly companyId: string;
  readonly leadScore: number;
  readonly priority: string;
  readonly status: string;
  readonly businessFitScore: number;
  readonly technicalOpportunityScore: number;
  readonly businessOpportunityScore: number;
  readonly decisionMakerFoundScore: number;
  readonly companyQualityScore: number;
  readonly scoreExplanation: string;
  readonly recommendedServiceId: string | null;
  readonly contactReason: string | null;
  readonly scoredAt: Date;
  readonly isStale: boolean;
  readonly company: {
    readonly id: string;
    readonly name: string;
    readonly industryId: string;
    readonly cityId: string | null;
    readonly countryId: string;
    readonly website: string | null;
    readonly verificationState: string;
    readonly discoverySource: string;
    readonly discoverySourceUrl: string;
    readonly doNotContactAt: Date | null;
    readonly doNotContactReason: string | null;
  };
}
