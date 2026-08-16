import { sql } from "drizzle-orm";

import type { Executor } from "../client";
import type { DependencyHealthStatus } from "../schema";

export interface HealthHistorySegment {
  /** The start of the period this segment covers, ISO 8601. */
  readonly at: string;
  /**
   * What was sampled in this period, or `null` when nothing was — before
   * sampling began, or while the prober itself was down. Never interpolated
   * from the samples on either side.
   */
  readonly status: DependencyHealthStatus | null;
  /** The worst latency seen in the period, or `null` when nothing was sampled. */
  readonly latencyMs: number | null;
}

export interface DependencyHistory {
  readonly dependency: string;
  readonly segments: readonly HealthHistorySegment[];
  /** The earliest sample held for this dependency, or `null` for none. */
  readonly earliestSampleAt: string | null;
  readonly sampledSegments: number;
  readonly totalSegments: number;
}

/**
 * Each dependency's sampled history over a window, one segment per bucket.
 *
 * The rule that shapes this query: **a bucket with no sample is returned with
 * `status: null`.** Not "up", not omitted, not filled from its neighbours. The
 * generated bucket series is left-joined against the samples precisely so a
 * gap survives into the response — the natural implementation, grouping the
 * samples that exist, would silently drop every unsampled period and leave the
 * bar looking continuous.
 *
 * When several samples fall in one bucket the worst wins, because a bucket
 * that was down for part of it was not up.
 */
export async function readDependencyHistory(
  executor: Executor,
  options: {
    readonly windowMinutes?: number;
    readonly bucketMinutes?: number;
  } = {},
): Promise<readonly DependencyHistory[]> {
  const windowMinutes = Math.min(Math.max(options.windowMinutes ?? 180, 1), 60 * 24 * 30);
  const bucketMinutes = Math.min(Math.max(options.bucketMinutes ?? 2, 1), 60 * 24);

  const rows = (await executor.execute(sql`
    with dependencies as (
      select distinct dependency from dependency_health_samples
    ),
    buckets as (
      select generate_series(
        date_trunc('minute', now()) - (interval '1 minute' * ${windowMinutes}),
        date_trunc('minute', now()),
        interval '1 minute' * ${bucketMinutes}
      ) as bucket_start
    ),
    grid as (
      select dependencies.dependency, buckets.bucket_start
      from dependencies cross join buckets
    ),
    sampled as (
      select
        grid.dependency,
        grid.bucket_start,
        -- Worst-wins: 'down' beats 'degraded' beats 'up'. A bucket that was
        -- down for part of it was not up for the bucket.
        max(
          case samples.status when 'down' then 3 when 'degraded' then 2 when 'up' then 1 end
        ) as severity,
        max(samples.latency_ms) as latency_ms
      from grid
      left join dependency_health_samples as samples
        on samples.dependency = grid.dependency
       and samples.sampled_at >= grid.bucket_start
       and samples.sampled_at < grid.bucket_start + (interval '1 minute' * ${bucketMinutes})
      group by grid.dependency, grid.bucket_start
    )
    select
      sampled.dependency as dependency,
      to_char(sampled.bucket_start at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at,
      case sampled.severity when 3 then 'down' when 2 then 'degraded' when 1 then 'up' else null end as status,
      sampled.latency_ms as latency_ms,
      to_char(
        (select min(sampled_at) from dependency_health_samples as first_sample
          where first_sample.dependency = sampled.dependency) at time zone 'utc',
        'YYYY-MM-DD"T"HH24:MI:SS"Z"'
      ) as earliest_sample_at
    from sampled
    order by sampled.dependency, sampled.bucket_start
  `)) as unknown as ReadonlyArray<{
    dependency: string;
    at: string;
    status: DependencyHealthStatus | null;
    latency_ms: number | string | null;
    earliest_sample_at: string | null;
  }>;

  const byDependency = new Map<string, HealthHistorySegment[]>();
  const earliest = new Map<string, string | null>();

  for (const row of rows) {
    const segments = byDependency.get(row.dependency) ?? [];
    segments.push({
      at: row.at,
      status: row.status,
      latencyMs: row.latency_ms === null ? null : Number(row.latency_ms),
    });
    byDependency.set(row.dependency, segments);
    earliest.set(row.dependency, row.earliest_sample_at);
  }

  return [...byDependency.entries()].map(([dependency, segments]) => ({
    dependency,
    segments,
    earliestSampleAt: earliest.get(dependency) ?? null,
    sampledSegments: segments.filter((segment) => segment.status !== null).length,
    totalSegments: segments.length,
  }));
}
