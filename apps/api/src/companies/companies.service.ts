import { Inject, Injectable } from "@nestjs/common";

import {
  type CompanyVerificationState,
  type Database,
  companies,
  leads,
  opportunities,
  opportunityAnalysisRuns,
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
   * Accepted opportunities for a company, newest first. There was previously
   * no way to read these except as the side effect of triggering a new
   * analysis run — the lead and company detail views need them without
   * re-running anything.
   */
  async listOpportunities(companyId: string) {
    return this.database
      .select()
      .from(opportunities)
      .where(eq(opportunities.companyId, companyId))
      .orderBy(desc(opportunities.createdAt));
  }
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
