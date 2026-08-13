import { Inject, Injectable } from "@nestjs/common";

import { MINIMUM_REPORTING_SAMPLE_SIZE } from "@mela/config";
import type { Database } from "@mela/database";
import { companies, leads, opportunities, outreach, outreachResponses } from "@mela/database";
import { eq, sql } from "drizzle-orm";
import { DATABASE } from "../database/database.module";

export interface OutreachAggregate {
  readonly segment: string;
  readonly value: string;
  readonly sent: number;
  readonly responded: number;
  readonly unrecorded: number;
  readonly responseRate: number | null;
  readonly belowMinimumSampleSize: boolean;
}

export interface AnalyticsQuery {
  readonly segment?:
    | "industry"
    | "service"
    | "opportunityCategory"
    | "priorityBand"
    | "scoreDecile";
  readonly value?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async getOutreachAggregates(query: AnalyticsQuery = {}): Promise<OutreachAggregate[]> {
    const sentOutreach = this.database
      .select({
        leadId: outreach.leadId,
        companyId: leads.companyId,
        priority: leads.priority,
        leadScore: leads.leadScore,
        recommendedServiceId: leads.recommendedServiceId,
        industryId: companies.industryId,
        opportunityCategoryId: opportunities.categoryId,
      })
      .from(outreach)
      .innerJoin(leads, eq(leads.id, outreach.leadId))
      .innerJoin(companies, eq(companies.id, leads.companyId))
      .leftJoin(
        opportunities,
        eq(opportunities.companyId, companies.id) &&
          eq(
            opportunities.runId,
            sql`(SELECT id FROM opportunity_analysis_runs WHERE company_id = ${companies.id} ORDER BY created_at DESC LIMIT 1)`,
          ),
      )
      .where(eq(outreach.status, "sent"));

    const rows = await sentOutreach;

    const responseMap = new Map<string, number>();
    const responseRows = await this.database
      .select({
        outreachId: outreachResponses.outreachId,
      })
      .from(outreachResponses)
      .innerJoin(outreach, eq(outreach.id, outreachResponses.outreachId))
      .where(eq(outreach.status, "sent"));

    for (const row of responseRows) {
      responseMap.set(row.outreachId, 1);
    }

    const aggregates = new Map<string, { sent: number; responded: number }>();

    for (const row of rows) {
      const key = this.getSegmentKey(row, query.segment);
      if (query.value !== undefined && key !== query.value) {
        continue;
      }

      const current = aggregates.get(key) || { sent: 0, responded: 0 };
      current.sent += 1;
      if (responseMap.has(row.leadId)) {
        current.responded += 1;
      }
      aggregates.set(key, current);
    }

    const result: OutreachAggregate[] = [];
    for (const [segment, value] of aggregates.entries()) {
      const unrecorded = value.sent - value.responded;
      const denominator = value.sent;
      const responseRate = denominator > 0 ? value.responded / denominator : null;
      const belowMinimum = denominator < MINIMUM_REPORTING_SAMPLE_SIZE;

      result.push({
        segment: query.segment ?? "all",
        value: segment,
        sent: value.sent,
        responded: value.responded,
        unrecorded,
        responseRate,
        belowMinimumSampleSize: belowMinimum,
      });
    }

    return result;
  }

  private getSegmentKey(row: any, segment?: string): string {
    if (segment === "industry") {
      return row.industryId ?? "unknown";
    }
    if (segment === "service") {
      return row.recommendedServiceId ?? "unknown";
    }
    if (segment === "opportunityCategory") {
      return row.opportunityCategoryId ?? "unknown";
    }
    if (segment === "priorityBand") {
      return row.priority ?? "unknown";
    }
    if (segment === "scoreDecile") {
      const score = row.leadScore ?? 0;
      const decile = Math.min(9, Math.floor(score / 10));
      return `decile_${decile}`;
    }
    return "all";
  }
}
