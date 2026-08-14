import { ANALYSIS_CONFIG } from "@mela/config";
import {
  type ActivityEntry,
  type AttentionItem,
  type DashboardSummary,
  type Database,
  type FunnelStage,
  readActivity,
  readAttention,
  readDashboardSummary,
  readFunnel,
} from "@mela/database";
import { Inject, Injectable } from "@nestjs/common";

import { DATABASE } from "../database/database.module";

/**
 * The dashboard's four aggregate reads.
 *
 * Each is one call into `@mela/database`'s read layer, where the counting is
 * done in SQL (design D4). This service exists to hold the window and
 * staleness settings, not to assemble anything — assembling counts in the API
 * is exactly what design D4 rules out.
 */
@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  /** Headline counts, each with the preceding period and a per-day series. */
  async getSummary(windowDays?: number): Promise<DashboardSummary> {
    return readDashboardSummary(this.database, { windowDays });
  }

  /** Companies by the furthest stage they reached. */
  async getFunnel(): Promise<readonly FunnelStage[]> {
    return readFunnel(this.database);
  }

  /** Recent workspace events from the audit trail. */
  async getActivity(limit?: number): Promise<readonly ActivityEntry[]> {
    return readActivity(this.database, { limit });
  }

  /** Everything waiting on a person, as one ordered list. */
  async getAttention(): Promise<readonly AttentionItem[]> {
    return readAttention(this.database, { stalenessDays: ANALYSIS_CONFIG.stalenessDays });
  }
}
