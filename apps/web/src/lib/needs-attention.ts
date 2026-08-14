/** One company sitting in a failure or unreachable state. */
export interface NeedsAttentionRecord {
  readonly companyId: string;
  readonly companyName: string;
  readonly industryId: string;
  readonly cityId: string | null;
  /** Null for the unreachable bucket — verification does not record a reason. */
  readonly reason: string | null;
  readonly since: string;
}

/** Every company needing attention, grouped by why — `GET /api/companies/needs-attention`. */
export interface NeedsAttentionResult {
  readonly blocked: readonly NeedsAttentionRecord[];
  readonly failed: readonly NeedsAttentionRecord[];
  readonly unreachable: readonly NeedsAttentionRecord[];
}
