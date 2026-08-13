/** A lead row as returned by `GET /api/leads` (JSON — `scoredAt` is an ISO string). */
export interface ListedLead {
  readonly id: string;
  readonly companyId: string;
  readonly companyName: string;
  readonly industryId: string;
  readonly cityId: string | null;
  readonly leadScore: number;
  readonly priority: string;
  readonly status: string;
  readonly scoredAt: string;
  readonly isStale: boolean;
}
