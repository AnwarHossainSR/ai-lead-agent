interface LatestAnalysisSummary {
  readonly outcome: string;
  readonly failureReason: string | null;
  readonly analysedUrl: string;
  readonly createdAt: string;
}

interface LatestOpportunityAnalysisSummary {
  readonly outcome: string;
  readonly reason: string | null;
  readonly createdAt: string;
}

interface LeadSummary {
  readonly id: string;
  readonly status: string;
  readonly priority: string;
  readonly leadScore: number;
}

/** A company row as returned by `GET /api/companies` — pipeline state assembled, not stored. */
export interface ListedCompany {
  readonly id: string;
  readonly name: string;
  readonly countryId: string;
  readonly cityId: string | null;
  readonly industryId: string;
  readonly website: string | null;
  readonly verificationState: string;
  readonly verifiedAt: string | null;
  readonly discoverySource: string;
  readonly discoverySourceUrl: string;
  readonly doNotContactAt: string | null;
  readonly doNotContactReason: string | null;
  readonly createdAt: string;
  /** Null means never analysed — a fourth state, distinct from every outcome. */
  readonly latestAnalysis: LatestAnalysisSummary | null;
  /** Null means opportunity analysis never ran for this company. */
  readonly latestOpportunityAnalysis: LatestOpportunityAnalysisSummary | null;
  /** Null means the company has not been scored into a lead. */
  readonly lead: LeadSummary | null;
}
