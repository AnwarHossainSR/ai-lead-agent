import { sql } from "drizzle-orm";

import type { Executor } from "../client";

/**
 * The two reads behind the operations screen's panels.
 *
 * The spend panel exists so a figure is readable as a proportion of what is
 * permitted: `$4.20` means nothing on its own and everything against a ceiling
 * of `$5`. The rate-limit panel is where the honesty rule costs something —
 * see `readRateLimits`.
 */

export interface SpendByStage {
  readonly stage: string;
  readonly amountUsd: number;
  readonly calls: number;
}

export interface SpendReport {
  /** The window the amount covers, in hours — the same window the ceiling governs. */
  readonly windowHours: number;
  readonly spentUsd: number;
  readonly ceilingUsd: number;
  readonly remainingUsd: number;
  readonly calls: number;
  /**
   * Per-prompt breakdown. A prompt that made no call in the window is present
   * with zeroes only if it made calls historically; one that has never run at
   * all is simply absent, since this read cannot know a prompt exists until it
   * has been invoked (spec: stages that invoked none are reported as having
   * made no calls).
   */
  readonly byStage: readonly SpendByStage[];
}

export async function readSpend(
  executor: Executor,
  options: { readonly windowHours: number; readonly ceilingUsd: number },
): Promise<SpendReport> {
  const { windowHours, ceilingUsd } = options;

  const rows = (await executor.execute(sql`
    with in_window as (
      select prompt_name, estimated_cost_usd
      from ai_invocations
      where created_at >= now() - (interval '1 hour' * ${windowHours})
    ),
    known_prompts as (select distinct prompt_name from ai_invocations)
    select
      known_prompts.prompt_name as stage,
      coalesce(sum(in_window.estimated_cost_usd), 0)::float as amount_usd,
      count(in_window.prompt_name)::int as calls
    from known_prompts
    left join in_window on in_window.prompt_name = known_prompts.prompt_name
    group by known_prompts.prompt_name
    order by coalesce(sum(in_window.estimated_cost_usd), 0) desc
  `)) as unknown as ReadonlyArray<{
    stage: string;
    amount_usd: number | string;
    calls: number | string;
  }>;

  const byStage = rows.map((row) => ({
    stage: row.stage,
    amountUsd: Number(row.amount_usd),
    calls: Number(row.calls),
  }));

  const spentUsd = byStage.reduce((total, stage) => total + stage.amountUsd, 0);
  const calls = byStage.reduce((total, stage) => total + stage.calls, 0);

  return {
    windowHours,
    spentUsd,
    ceilingUsd,
    // Clamped at zero: a ceiling already exceeded has nothing remaining, and a
    // negative "remaining" reads as credit.
    remainingUsd: Math.max(0, ceilingUsd - spentUsd),
    calls,
    byStage,
  };
}

export interface RateLimitStatus {
  readonly sourceId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly configuredMaxRequestsPerMinute: number;
  /**
   * Requests actually made in the last minute — **`null` always, today**.
   *
   * The politeness limiter enforces this rate in memory inside the running
   * process; nothing writes a per-request timestamp to the database, so there
   * is no recorded usage to report. Returning `0` here would say every source
   * is idle, which is a claim this read cannot support. The `unrecordedReason`
   * below says so in the response rather than leaving a bare null for the
   * interface to guess at.
   */
  readonly observedRequestsLastMinute: number | null;
  readonly unrecordedReason: string | null;
  /** The last time this source returned anything, from the run record. */
  readonly lastUsedAt: string | null;
}

const USAGE_NOT_RECORDED =
  "Per-request timing is enforced in the running process and not persisted, so usage against this limit is not recorded.";

/**
 * Each configured source's limit, and what the database can say about its use.
 */
export async function readRateLimits(
  executor: Executor,
  sources: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly enabled: boolean;
    readonly maxRequestRatePerMinute: number;
  }>,
): Promise<readonly RateLimitStatus[]> {
  const rows = (await executor.execute(sql`
    select
      discovery_run_sources.source_id as source_id,
      to_char(max(discovery_runs.started_at) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_used_at
    from discovery_run_sources
    join discovery_runs on discovery_runs.id = discovery_run_sources.run_id
    group by discovery_run_sources.source_id
  `)) as unknown as ReadonlyArray<{ source_id: string; last_used_at: string | null }>;

  const lastUsed = new Map(rows.map((row) => [row.source_id, row.last_used_at]));

  return sources.map((source) => ({
    sourceId: source.id,
    name: source.name,
    enabled: source.enabled,
    configuredMaxRequestsPerMinute: source.maxRequestRatePerMinute,
    observedRequestsLastMinute: null,
    unrecordedReason: USAGE_NOT_RECORDED,
    lastUsedAt: lastUsed.get(source.id) ?? null,
  }));
}
