/** One segment's outreach response performance — `GET /api/analytics/outreach`. */
export interface OutreachAggregate {
  readonly segment: string;
  readonly value: string;
  readonly sent: number;
  readonly responded: number;
  readonly unrecorded: number;
  readonly responseRate: number | null;
  readonly belowMinimumSampleSize: boolean;
}

export type AnalyticsSegment =
  | "industry"
  | "service"
  | "opportunityCategory"
  | "priorityBand"
  | "scoreDecile";
