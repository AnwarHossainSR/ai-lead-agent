import { Inject, Injectable } from "@nestjs/common";

import {
  type CompanyVerificationState,
  type Database,
  type Observation,
  type OpportunityRow,
  companies,
  leads,
  opportunities,
  opportunityAnalysisRuns,
  technologyDetections,
  websiteAnalysis,
} from "@mela/database";
import { type SQL, and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { DATABASE } from "../database/database.module";

export interface CompanyFilters {
  readonly verificationState?: CompanyVerificationState;
  readonly countryId?: string;
  readonly cityId?: string;
  readonly industryId?: string;
}

export interface ListCompaniesOptions extends CompanyFilters {
  readonly order?: "created_desc" | "name_asc";
  readonly limit?: number;
  readonly offset?: number;
}

interface LatestAnalysis {
  readonly outcome: string;
  readonly failureReason: string | null;
  readonly analysedUrl: string;
  readonly createdAt: Date;
}

interface LatestOpportunityAnalysis {
  readonly outcome: string;
  readonly reason: string | null;
  readonly createdAt: Date;
}

interface LeadSummary {
  readonly id: string;
  readonly status: string;
  readonly priority: string;
  readonly leadScore: number;
}

export interface NeedsAttentionRecord {
  readonly companyId: string;
  readonly companyName: string;
  readonly industryId: string;
  readonly cityId: string | null;
  /** Null for the unreachable bucket — verification does not record a reason. */
  readonly reason: string | null;
  readonly since: Date;
}

export interface NeedsAttentionResult {
  readonly blocked: readonly NeedsAttentionRecord[];
  readonly failed: readonly NeedsAttentionRecord[];
  readonly unreachable: readonly NeedsAttentionRecord[];
}

export interface CompanyDetail {
  readonly id: string;
  readonly name: string;
  readonly countryId: string;
  readonly cityId: string | null;
  readonly industryId: string;
  readonly website: string | null;
  readonly verificationState: string;
  readonly verifiedAt: Date | null;
  readonly discoverySource: string;
  readonly discoverySourceUrl: string;
  readonly doNotContactAt: Date | null;
  readonly doNotContactReason: string | null;
  readonly createdAt: Date;
  /** Null means the company has not been scored into a lead. */
  readonly lead: LeadSummary | null;
}

export interface ListedCompany {
  readonly id: string;
  readonly name: string;
  readonly countryId: string;
  readonly cityId: string | null;
  readonly industryId: string;
  readonly website: string | null;
  readonly verificationState: string;
  readonly verifiedAt: Date | null;
  readonly discoverySource: string;
  readonly discoverySourceUrl: string;
  readonly doNotContactAt: Date | null;
  readonly doNotContactReason: string | null;
  readonly createdAt: Date;
  /** Null means never analysed — a fourth state, distinct from every outcome. */
  readonly latestAnalysis: LatestAnalysis | null;
  /** Null means opportunity analysis never ran for this company. */
  readonly latestOpportunityAnalysis: LatestOpportunityAnalysis | null;
  /** Null means the company has not been scored into a lead. */
  readonly lead: LeadSummary | null;
}

/**
 * "Pipeline state" for the company list (design D6) is assembled, not
 * stored: verification lives on `companies`, the website analysis and
 * opportunity analysis outcomes are the latest row per company from their
 * own history tables, and whether a lead exists is a lookup into `leads`.
 * There is no single column that answers "where is this company in the
 * pipeline" — that is the point of design D4: failure states are recorded
 * where they happened, not flattened onto the company.
 */
@Injectable()
export class CompaniesService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  private buildCompanyConditions(options: CompanyFilters): SQL[] {
    const conditions: SQL[] = [];

    if (options.verificationState) {
      conditions.push(eq(companies.verificationState, options.verificationState));
    }
    if (options.countryId) {
      conditions.push(eq(companies.countryId, options.countryId));
    }
    if (options.cityId) {
      conditions.push(eq(companies.cityId, options.cityId));
    }
    if (options.industryId) {
      conditions.push(eq(companies.industryId, options.industryId));
    }

    return conditions;
  }

  async countCompanies(options: CompanyFilters = {}): Promise<number> {
    const conditions = this.buildCompanyConditions(options);

    const [row] = await this.database
      .select({ value: count() })
      .from(companies)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return row?.value ?? 0;
  }

  async listCompanies(options: ListCompaniesOptions = {}): Promise<ListedCompany[]> {
    const conditions = this.buildCompanyConditions(options);

    const orderColumn =
      options.order === "name_asc" ? asc(companies.name) : desc(companies.createdAt);

    const rows = await this.database
      .select()
      .from(companies)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderColumn)
      .limit(options.limit ?? 50)
      .offset(options.offset ?? 0);

    const companyIds = rows.map((row) => row.id);

    if (companyIds.length === 0) {
      return [];
    }

    const [analyses, opportunityRuns, leadRows] = await Promise.all([
      this.database
        .select({
          companyId: websiteAnalysis.companyId,
          outcome: websiteAnalysis.outcome,
          failureReason: websiteAnalysis.failureReason,
          analysedUrl: websiteAnalysis.analysedUrl,
          createdAt: websiteAnalysis.createdAt,
        })
        .from(websiteAnalysis)
        .where(inArray(websiteAnalysis.companyId, companyIds))
        .orderBy(desc(websiteAnalysis.createdAt)),
      this.database
        .select({
          companyId: opportunityAnalysisRuns.companyId,
          outcome: opportunityAnalysisRuns.outcome,
          reason: opportunityAnalysisRuns.reason,
          createdAt: opportunityAnalysisRuns.createdAt,
        })
        .from(opportunityAnalysisRuns)
        .where(inArray(opportunityAnalysisRuns.companyId, companyIds))
        .orderBy(desc(opportunityAnalysisRuns.createdAt)),
      this.database
        .select({
          id: leads.id,
          companyId: leads.companyId,
          status: leads.status,
          priority: leads.priority,
          leadScore: leads.leadScore,
        })
        .from(leads)
        .where(inArray(leads.companyId, companyIds)),
    ]);

    const latestAnalysisByCompany = latestPerCompany(analyses);
    const latestOpportunityByCompany = latestPerCompany(opportunityRuns);
    const leadByCompany = new Map(leadRows.map((lead) => [lead.companyId, lead]));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      countryId: row.countryId,
      cityId: row.cityId,
      industryId: row.industryId,
      website: row.website,
      verificationState: row.verificationState,
      verifiedAt: row.verifiedAt,
      discoverySource: row.discoverySource,
      discoverySourceUrl: row.discoverySourceUrl,
      doNotContactAt: row.doNotContactAt,
      doNotContactReason: row.doNotContactReason,
      createdAt: row.createdAt,
      latestAnalysis: latestAnalysisByCompany.get(row.id) ?? null,
      latestOpportunityAnalysis: latestOpportunityByCompany.get(row.id) ?? null,
      lead: leadByCompany.get(row.id) ?? null,
    }));
  }

  /**
   * A single company with its lead (if scored), for the company detail
   * view. Mirrors `ScoringService.getLead` — same "look it up directly,
   * don't force a caller to fetch the whole list" reasoning.
   */
  async getCompany(companyId: string): Promise<CompanyDetail | null> {
    const [row] = await this.database
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    const [lead] = await this.database
      .select({
        id: leads.id,
        status: leads.status,
        priority: leads.priority,
        leadScore: leads.leadScore,
      })
      .from(leads)
      .where(eq(leads.companyId, companyId))
      .limit(1);

    return {
      id: row.id,
      name: row.name,
      countryId: row.countryId,
      cityId: row.cityId,
      industryId: row.industryId,
      website: row.website,
      verificationState: row.verificationState,
      verifiedAt: row.verifiedAt,
      discoverySource: row.discoverySource,
      discoverySourceUrl: row.discoverySourceUrl,
      doNotContactAt: row.doNotContactAt,
      doNotContactReason: row.doNotContactReason,
      createdAt: row.createdAt,
      lead: lead ?? null,
    };
  }

  /**
   * Every company sitting in a failure or unreachable state, across all
   * three pipeline stages (design D4): unreachable at verification, and
   * blocked or failed at either analysis stage. Sorted oldest-first within
   * each bucket, since the point of "needs attention" is what has been
   * neglected longest, not what happened most recently.
   */
  async getNeedsAttention(): Promise<NeedsAttentionResult> {
    const [companyRows, analyses, opportunityRuns] = await Promise.all([
      this.database
        .select({
          id: companies.id,
          name: companies.name,
          industryId: companies.industryId,
          cityId: companies.cityId,
          verificationState: companies.verificationState,
          verifiedAt: companies.verifiedAt,
          createdAt: companies.createdAt,
        })
        .from(companies),
      this.database
        .select({
          companyId: websiteAnalysis.companyId,
          outcome: websiteAnalysis.outcome,
          failureReason: websiteAnalysis.failureReason,
          createdAt: websiteAnalysis.createdAt,
        })
        .from(websiteAnalysis)
        .orderBy(desc(websiteAnalysis.createdAt)),
      this.database
        .select({
          companyId: opportunityAnalysisRuns.companyId,
          outcome: opportunityAnalysisRuns.outcome,
          reason: opportunityAnalysisRuns.reason,
          createdAt: opportunityAnalysisRuns.createdAt,
        })
        .from(opportunityAnalysisRuns)
        .orderBy(desc(opportunityAnalysisRuns.createdAt)),
    ]);

    const latestAnalysisByCompany = latestPerCompany(analyses);
    const latestOpportunityByCompany = latestPerCompany(opportunityRuns);

    const blocked: NeedsAttentionRecord[] = [];
    const failed: NeedsAttentionRecord[] = [];
    const unreachable: NeedsAttentionRecord[] = [];

    for (const company of companyRows) {
      const base = {
        companyId: company.id,
        companyName: company.name,
        industryId: company.industryId,
        cityId: company.cityId,
      };

      if (company.verificationState === "unreachable") {
        unreachable.push({
          ...base,
          reason: null,
          since: company.verifiedAt ?? company.createdAt,
        });
      }

      const analysis = latestAnalysisByCompany.get(company.id);
      if (analysis?.outcome === "blocked") {
        blocked.push({ ...base, reason: analysis.failureReason, since: analysis.createdAt });
      } else if (analysis?.outcome === "failed") {
        failed.push({ ...base, reason: analysis.failureReason, since: analysis.createdAt });
      }

      const opportunityRun = latestOpportunityByCompany.get(company.id);
      if (opportunityRun?.outcome === "failed") {
        failed.push({ ...base, reason: opportunityRun.reason, since: opportunityRun.createdAt });
      }
    }

    const byAge = (a: NeedsAttentionRecord, b: NeedsAttentionRecord) =>
      a.since.getTime() - b.since.getTime();

    return {
      blocked: blocked.sort(byAge),
      failed: failed.sort(byAge),
      unreachable: unreachable.sort(byAge),
    };
  }

  /**
   * Accepted opportunities for a company, newest first, with their cited
   * evidence resolved to a source URL and detail (design D2). There was
   * previously no way to read these except as the side effect of triggering
   * a new analysis run — the lead and company detail views need them
   * without re-running anything.
   */
  async listOpportunities(companyId: string): Promise<OpportunityWithEvidence[]> {
    const rows = await this.database
      .select()
      .from(opportunities)
      .where(eq(opportunities.companyId, companyId))
      .orderBy(desc(opportunities.createdAt));

    if (rows.length === 0) {
      return [];
    }

    const runIds = [...new Set(rows.map((row) => row.runId))];
    const runs = await this.database
      .select({
        id: opportunityAnalysisRuns.id,
        websiteAnalysisId: opportunityAnalysisRuns.websiteAnalysisId,
      })
      .from(opportunityAnalysisRuns)
      .where(inArray(opportunityAnalysisRuns.id, runIds));
    const analysisIdByRun = new Map(runs.map((run) => [run.id, run.websiteAnalysisId]));

    const analysisIds = [...new Set(runs.map((run) => run.websiteAnalysisId))].filter(
      (id): id is string => id !== null,
    );

    const [analyses, detections] =
      analysisIds.length > 0
        ? await Promise.all([
            this.database
              .select()
              .from(websiteAnalysis)
              .where(inArray(websiteAnalysis.id, analysisIds)),
            this.database
              .select()
              .from(technologyDetections)
              .where(inArray(technologyDetections.analysisId, analysisIds)),
          ])
        : [[], []];

    const analysisById = new Map(analyses.map((analysis) => [analysis.id, analysis]));
    const detectionsByAnalysis = new Map<string, typeof detections>();
    for (const detection of detections) {
      const list = detectionsByAnalysis.get(detection.analysisId) ?? [];
      list.push(detection);
      detectionsByAnalysis.set(detection.analysisId, list);
    }

    return rows.map((row) => ({
      ...row,
      resolvedEvidence: resolveCitedEvidence(
        row.citedEvidence as readonly string[],
        analysisById.get(analysisIdByRun.get(row.runId) ?? "") ?? null,
        detectionsByAnalysis.get(analysisIdByRun.get(row.runId) ?? "") ?? [],
      ),
    }));
  }
}

interface ResolvedEvidence {
  readonly ref: string;
  /** What was matched — an observation's detail, or a detected technology and its match. */
  readonly detail: string;
  /** Null when the analysis behind the citation could no longer be found. */
  readonly url: string | null;
}

export interface OpportunityWithEvidence extends OpportunityRow {
  readonly resolvedEvidence: readonly ResolvedEvidence[];
}

/**
 * `opportunities.cited_evidence` stores refs like `o1`, `t2` — positions into
 * the observations and detections that existed when the opportunity was
 * generated (see `buildModelInput`), not resolved text. This reconstructs the
 * same ref -> evidence mapping from the pinned analysis so the UI can show
 * what was actually cited, rather than an opaque identifier.
 *
 * A ref that can't be resolved (the analysis was deleted, or refs predate
 * `opportunity_analysis_runs.website_analysis_id` being recorded) renders as
 * an explicit unresolved state (design D4) rather than being dropped.
 */
function resolveCitedEvidence(
  refs: readonly string[],
  analysis: { readonly analysedUrl: string; readonly observations: readonly Observation[] } | null,
  detections: readonly { readonly technologyId: string; readonly matchedText: string | null }[],
): ResolvedEvidence[] {
  const refMap = new Map<string, { detail: string; url: string }>();

  if (analysis !== null) {
    analysis.observations.forEach((observation, index) => {
      refMap.set(`o${index + 1}`, {
        detail: observation.evidence.detail,
        url: observation.evidence.url,
      });
    });

    detections.forEach((detection, index) => {
      refMap.set(`t${index + 1}`, {
        detail: detection.matchedText
          ? `${detection.technologyId}: "${detection.matchedText}"`
          : detection.technologyId,
        url: analysis.analysedUrl,
      });
    });
  }

  return refs.map((ref) => {
    const resolved = refMap.get(ref);
    return resolved
      ? { ref, ...resolved }
      : { ref, detail: "This citation could not be resolved to its source.", url: null };
  });
}

/** Keeps the first row seen per `companyId`, given rows ordered newest first. */
function latestPerCompany<T extends { companyId: string }>(rows: readonly T[]): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    if (!result.has(row.companyId)) {
      result.set(row.companyId, row);
    }
  }
  return result;
}
