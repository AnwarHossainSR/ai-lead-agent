import {
  startDiscoveryRun,
  recordDiscoveryRunSource,
  finishDiscoveryRun,
  type Executor,
  type DiscoveryRunRow,
} from "@mela/database";
import {
  ACTIVE_DISCOVERY_SOURCES,
  COUNTRIES,
  INDUSTRIES,
  CITIES,
  findCity,
  isCountryId,
  isIndustryId,
  type DiscoverySourceId,
} from "@mela/config";

import { DedupService, type DedupInput } from "./dedup.service";
import {
  type DiscoveryRequest,
  type DiscoverySource,
  type DiscoverySourceResult,
  validateCandidate,
} from "./sources/source";
import { TokenBucket, effectiveRequestIntervalMs } from "../http/rate-limiter";

/**
 * The input to start a discovery run (design D6).
 */
export interface RunRequest {
  readonly countryId: string;
  readonly cityId?: string;
  readonly industryId: string;
  readonly candidateLimit: number;
  readonly durationLimitSeconds: number;
}

/**
 * The outcome of a completed discovery run.
 */
export interface RunResult {
  readonly run: DiscoveryRunRow;
  readonly storedCount: number;
  readonly duplicateCount: number;
  readonly rejectedCount: number;
  readonly failedSources: readonly string[];
  readonly blockedSources: readonly string[];
}

/**
 * Configuration for the run service.
 */
export interface RunServiceConfig {
  /** Clock for measuring duration; injectable for tests. */
  readonly now?: () => number;
}

/**
 * The run service orchestrates a discovery run (design D6).
 *
 * 1. Validates territory and industry identifiers against configuration
 * 2. Selects enabled sources covering the requested country
 * 3. Iterates sources through the rate limiter
 * 4. Collects candidates, deduplicates them, and records per-source counts
 * 5. Enforces candidate and duration limits
 * 6. Records run completion with the appropriate outcome
 */
export class RunService {
  private readonly dedupService: DedupService;
  private readonly now: () => number;

  constructor(config: RunServiceConfig = {}) {
    this.dedupService = new DedupService();
    this.now = config.now ?? (() => Date.now());
  }

  /**
   * Validates the territory and industry identifiers, returning an error if
   * any are unknown. The error names the supplied value and lists configured
   * ones.
   */
  validateTerritory(request: RunRequest): void {
    if (!isCountryId(request.countryId)) {
      const known = COUNTRIES.map((c) => c.id).join(", ");
      throw new Error(
        `Unknown country identifier "${request.countryId}". Configured countries: ${known}.`,
      );
    }

    if (!isIndustryId(request.industryId)) {
      const known = INDUSTRIES.map((i) => i.id).join(", ");
      throw new Error(
        `Unknown industry identifier "${request.industryId}". Configured industries: ${known}.`,
      );
    }

    if (request.cityId !== undefined) {
      const city = findCity(request.cityId);
      if (city === undefined) {
        const known = CITIES.filter((c) => c.countryId === request.countryId)
          .map((c) => c.id)
          .join(", ");
        throw new Error(
          `Unknown city identifier "${request.cityId}". Configured cities for "${request.countryId}": ${known || "none"}.`,
        );
      }
      if (city.countryId !== request.countryId) {
        throw new Error(
          `City "${request.cityId}" belongs to country "${city.countryId}", not "${request.countryId}".`,
        );
      }
    }
  }

  /**
   * Selects enabled sources covering the requested country.
   */
  selectSources(countryId: string): readonly DiscoverySourceId[] {
    return ACTIVE_DISCOVERY_SOURCES.filter((source) =>
      source.coveredCountries.includes(countryId),
    ).map((source) => source.id as DiscoverySourceId);
  }

  /**
   * Executes a discovery run. This is the main orchestration method.
   *
   * @param executor - Database transaction executor
   * @param sources - Map of source IDs to their implementations
   * @param request - The run request with territory and limits
   * @returns The run result with counts and outcomes
   */
  async executeRun(
    executor: Executor,
    sources: ReadonlyMap<DiscoverySourceId, DiscoverySource>,
    request: RunRequest,
  ): Promise<RunResult> {
    // 1. Validate territory and industry
    this.validateTerritory(request);

    // 2. Select enabled sources covering this country
    const enabledSourceIds = this.selectSources(request.countryId);

    // 3. Start the run in the database
    const run = await startDiscoveryRun(executor, {
      countryId: request.countryId,
      cityId: request.cityId,
      industryId: request.industryId,
      candidateLimit: request.candidateLimit,
      durationLimitSeconds: request.durationLimitSeconds,
    });

    const discoveryRequest: DiscoveryRequest = {
      countryId: request.countryId,
      cityId: request.cityId,
      industryId: request.industryId,
    };

    let totalStored = 0;
    let totalDuplicates = 0;
    let totalRejected = 0;
    const failedSources: string[] = [];
    const blockedSources: string[] = [];
    let hitCandidateLimit = false;
    let hitTimeLimit = false;

    const startTime = this.now();
    const buckets = new Map<DiscoverySourceId, TokenBucket>();

    // Create rate limit buckets for each source
    for (const sourceId of enabledSourceIds) {
      const sourceConfig = ACTIVE_DISCOVERY_SOURCES.find((s) => s.id === sourceId);
      if (sourceConfig) {
        buckets.set(
          sourceId,
          new TokenBucket(1, effectiveRequestIntervalMs(sourceConfig.maxRequestRatePerMinute, null), this.now),
        );
      }
    }

    // 4. Iterate through sources
    for (const sourceId of enabledSourceIds) {
      // Check time limit before starting a new source
      const elapsed = this.now() - startTime;
      if (elapsed >= request.durationLimitSeconds * 1000) {
        hitTimeLimit = true;
        break;
      }

      // Check candidate limit
      if (totalStored >= request.candidateLimit) {
        hitCandidateLimit = true;
        break;
      }

      const source = sources.get(sourceId);
      if (source === undefined) {
        // Source not provided - skip it
        await recordDiscoveryRunSource(executor, {
          runId: run.id,
          sourceId,
          outcome: "skipped",
          note: "Source implementation not provided",
        });
        continue;
      }

      // Rate limit
      const bucket = buckets.get(sourceId);
      if (bucket) {
        await bucket.acquire();
      }

      // Fetch from source
      let result: DiscoverySourceResult;
      try {
        result = await source.fetch(discoveryRequest);
      } catch (error) {
        result = {
          outcome: "failed",
          reason: error instanceof Error ? error.message : "Unknown error",
        };
      }

      // Process result
      const remainingCapacity = request.candidateLimit - totalStored;

      const stats = await this.processSourceResult(
        executor,
        sourceId,
        run.id,
        result,
        request.countryId,
        request.cityId,
        request.industryId,
        remainingCapacity,
        startTime,
        request.durationLimitSeconds * 1000,
      );

      totalStored += stats.stored;
      totalDuplicates += stats.duplicate;
      totalRejected += stats.rejected;

      // Check if limits were hit during source processing
      if (stats.hitCandidateLimit) {
        hitCandidateLimit = true;
      }
      if (stats.hitTimeLimit) {
        hitTimeLimit = true;
      }

      if (result.outcome === "failed") {
        failedSources.push(sourceId);
      } else if (result.outcome === "blocked") {
        blockedSources.push(sourceId);
      }

      // Record per-source result
      await recordDiscoveryRunSource(executor, {
        runId: run.id,
        sourceId,
        outcome: result.outcome === "succeeded" ? "succeeded" : result.outcome,
        returnedCount: result.outcome === "succeeded" ? result.candidates.length : 0,
        storedCount: stats.stored,
        duplicateCount: stats.duplicate,
        rejectedCount: stats.rejected,
        rejections: [...stats.rejections],
        note:
          result.outcome === "blocked"
            ? result.note
            : result.outcome === "failed"
              ? result.reason
              : undefined,
      });
    }

    // 5. Determine final outcome
    let outcome: "succeeded" | "partial" | "limit_reached" | "failed";

    if (hitCandidateLimit) {
      outcome = "limit_reached";
    } else if (hitTimeLimit) {
      outcome = "limit_reached";
    } else if (failedSources.length > 0 || blockedSources.length > 0) {
      // Some sources failed or were blocked
      if (failedSources.length + blockedSources.length < enabledSourceIds.length) {
        outcome = "partial";
      } else {
        outcome = "failed";
      }
    } else {
      outcome = "succeeded";
    }

    // 6. Finish the run
    const finishedRun = await finishDiscoveryRun(executor, run.id, {
      outcome,
      failureReason: hitCandidateLimit
        ? "candidate_limit"
        : hitTimeLimit
          ? "duration_limit"
          : undefined,
    });

    return {
      run: finishedRun,
      storedCount: totalStored,
      duplicateCount: totalDuplicates,
      rejectedCount: totalRejected,
      failedSources,
      blockedSources,
    };
  }

  /**
   * Processes a source result, deduplicating candidates and collecting stats.
   */
  private async processSourceResult(
    executor: Executor,
    sourceId: string,
    runId: string,
    result: DiscoverySourceResult,
    countryId: string,
    cityId: string | undefined,
    industryId: string,
    remainingCapacity: number,
    runStartTime: number,
    durationLimitMs: number,
  ): Promise<{
    stored: number;
    duplicate: number;
    rejected: number;
    rejections: readonly { readonly reason: string; readonly count: number }[];
    hitCandidateLimit: boolean;
    hitTimeLimit: boolean;
  }> {
    if (result.outcome !== "succeeded") {
      return { stored: 0, duplicate: 0, rejected: 0, rejections: [], hitCandidateLimit: false, hitTimeLimit: false };
    }

    let stored = 0;
    let duplicate = 0;
    let rejected = 0;
    const rejectionCounts = new Map<string, number>();
    let hitCandidateLimit = false;
    let hitTimeLimit = false;

    for (const rawCandidate of result.candidates) {
      // Check candidate limit
      if (stored >= remainingCapacity) {
        hitCandidateLimit = true;
        break;
      }

      // Check time limit
      if (this.now() - runStartTime >= durationLimitMs) {
        hitTimeLimit = true;
        break;
      }

      // Validate candidate
      const validation = validateCandidate(rawCandidate);
      if (!validation.ok) {
        rejected += 1;
        const count = rejectionCounts.get(validation.reason) ?? 0;
        rejectionCounts.set(validation.reason, count + 1);
        continue;
      }

      // Deduplicate
      const dedupInput: DedupInput = {
        candidate: validation.candidate,
        runId,
        sourceId,
        countryId,
        cityId,
        industryId,
      };

      const dedupResult = await this.dedupService.deduplicate(executor, dedupInput);

      if (dedupResult.kind === "stored") {
        stored += 1;
      } else {
        duplicate += 1;
      }
    }

    // Add source rejections
    for (const rejection of result.rejections) {
      const count = rejectionCounts.get(rejection.reason) ?? 0;
      rejectionCounts.set(rejection.reason, count + rejection.count);
    }

    const rejections: { readonly reason: string; readonly count: number }[] = [];
    for (const [reason, count] of rejectionCounts) {
      rejections.push({ reason, count });
    }

    return { stored, duplicate, rejected, rejections, hitCandidateLimit, hitTimeLimit };
  }
}
