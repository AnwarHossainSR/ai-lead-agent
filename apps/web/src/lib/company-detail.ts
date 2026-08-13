/** A company's own identity and lead status, if scored — `GET /api/companies/:id`. */
export interface CompanyDetail {
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
  /** Null means the company has not been scored into a lead. */
  readonly lead: {
    readonly id: string;
    readonly status: string;
    readonly priority: string;
    readonly leadScore: number;
  } | null;
}
