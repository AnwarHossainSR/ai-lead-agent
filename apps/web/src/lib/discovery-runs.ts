/** What a run saw at one source — `GET /api/discovery/runs`. */
export interface DiscoveryRunSource {
  readonly id: string;
  readonly runId: string;
  readonly sourceId: string;
  readonly outcome: "succeeded" | "skipped" | "blocked" | "failed";
  readonly returnedCount: number;
  readonly storedCount: number;
  readonly duplicateCount: number;
  readonly rejectedCount: number;
  readonly rejections: readonly { reason: string; count: number }[];
  readonly note: string | null;
}

/** One discovery run: what was searched, what bounded it, and how it ended. */
export interface DiscoveryRun {
  readonly id: string;
  readonly countryId: string;
  readonly cityId: string | null;
  readonly industryId: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly outcome: "running" | "succeeded" | "partial" | "limit_reached" | "failed";
  readonly candidateLimit: number;
  readonly durationLimitSeconds: number;
  readonly failureReason: string | null;
}

export interface DiscoveryRunRecord {
  readonly run: DiscoveryRun;
  readonly sources: readonly DiscoveryRunSource[];
}
