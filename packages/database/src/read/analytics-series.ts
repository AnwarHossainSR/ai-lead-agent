import { sql } from "drizzle-orm";

import type { Executor } from "../client";

/**
 * The four series behind the analytics screen.
 *
 * Every series carries the number of records it was computed from, because a
 * chart without its sample size is a shape that looks equally confident at
 * n=3 and n=3000. Two rules follow from that and are enforced here rather than
 * at the call site:
 *
 * - **A bucket below the configured minimum is marked**, so the interface can
 *   present it differently.
 * - **A *rate* below that minimum is withheld** — returned as `null` with its
 *   sample size intact — rather than returned as a number nobody should act
 *   on. Counts and amounts are not withheld: a count of three is exactly three
 *   and misleads nobody.
 *
 * And a window with no records at all reports `empty: true` rather than a
 * series of zeroes, which would say the activity happened and measured nothing.
 */

export interface AnalyticsBucket {
  readonly label: string;
  /**
   * The bucket's value, or `null` when it is a rate withheld for having too
   * small a sample. `sampleSize` is still returned either way.
   */
  readonly value: number | null;
  readonly sampleSize: number;
  readonly belowMinimum: boolean;
}

export interface AnalyticsSeries {
  readonly id: string;
  readonly label: string;
  /** `count`, `amount` (USD) or `rate` (0–1). Only a rate is ever withheld. */
  readonly valueKind: "count" | "amount" | "rate";
  readonly windowDays: number;
  readonly buckets: readonly AnalyticsBucket[];
  readonly totalSampleSize: number;
  /** True when the window held no records at all. */
  readonly empty: boolean;
  readonly minimumSampleSize: number;
}

interface BucketRow {
  readonly label: string;
  readonly value: number | string | null;
  readonly sample_size: number | string;
}

function assemble(
  id: string,
  label: string,
  valueKind: AnalyticsSeries["valueKind"],
  windowDays: number,
  minimumSampleSize: number,
  rows: readonly BucketRow[],
): AnalyticsSeries {
  const buckets = rows.map((row) => {
    const sampleSize = Number(row.sample_size);
    const belowMinimum = sampleSize < minimumSampleSize;
    const rawValue = row.value === null ? null : Number(row.value);

    return {
      label: row.label,
      // Only a rate is withheld. A count or an amount below the minimum is
      // still exactly what it is.
      value: valueKind === "rate" && belowMinimum ? null : rawValue,
      sampleSize,
      belowMinimum,
    };
  });

  const totalSampleSize = buckets.reduce((total, bucket) => total + bucket.sampleSize, 0);

  return {
    id,
    label,
    valueKind,
    windowDays,
    buckets,
    totalSampleSize,
    empty: totalSampleSize === 0,
    minimumSampleSize,
  };
}

/** Companies discovered per day in the window, by the source that found them. */
export async function readDiscoverySeries(
  executor: Executor,
  options: { readonly windowDays?: number; readonly minimumSampleSize: number },
): Promise<AnalyticsSeries> {
  const windowDays = options.windowDays ?? 30;

  const rows = (await executor.execute(sql`
    select
      discovery_source as label,
      count(*)::int as value,
      count(*)::int as sample_size
    from companies
    where created_at >= now() - (interval '1 day' * ${windowDays})
    group by discovery_source
    order by count(*) desc
  `)) as unknown as BucketRow[];

  return assemble(
    "discovery",
    "Companies discovered by source",
    "count",
    windowDays,
    options.minimumSampleSize,
    rows,
  );
}

/** How lead scores are distributed, in tens. */
export async function readScoreSeries(
  executor: Executor,
  options: { readonly windowDays?: number; readonly minimumSampleSize: number },
): Promise<AnalyticsSeries> {
  const windowDays = options.windowDays ?? 30;

  const rows = (await executor.execute(sql`
    with banded as (
      select least(9, greatest(0, lead_score / 10)) as band
      from leads
      where scored_at >= now() - (interval '1 day' * ${windowDays})
    )
    select
      (band * 10)::text || '–' || (band * 10 + 9)::text as label,
      count(*)::int as value,
      count(*)::int as sample_size
    from banded
    group by band
    order by band
  `)) as unknown as BucketRow[];

  return assemble(
    "scores",
    "Lead score distribution",
    "count",
    windowDays,
    options.minimumSampleSize,
    rows,
  );
}

/**
 * The share of drafts in each status that reached approval.
 *
 * A rate, so the minimum-sample rule bites: a status with three drafts in it
 * reports its sample size and withholds the rate.
 */
export async function readConversionSeries(
  executor: Executor,
  options: { readonly windowDays?: number; readonly minimumSampleSize: number },
): Promise<AnalyticsSeries> {
  const windowDays = options.windowDays ?? 30;

  const rows = (await executor.execute(sql`
    select
      leads.priority as label,
      (count(*) filter (where outreach.approved_at is not null))::float / nullif(count(*), 0) as value,
      count(*)::int as sample_size
    from outreach
    join leads on leads.id = outreach.lead_id
    where outreach.created_at >= now() - (interval '1 day' * ${windowDays})
    group by leads.priority
    order by leads.priority
  `)) as unknown as BucketRow[];

  return assemble(
    "conversion",
    "Draft-to-approval rate by lead priority",
    "rate",
    windowDays,
    options.minimumSampleSize,
    rows,
  );
}

/** Model spend in the window, by the prompt that incurred it. */
export async function readSpendSeries(
  executor: Executor,
  options: { readonly windowDays?: number; readonly minimumSampleSize: number },
): Promise<AnalyticsSeries> {
  const windowDays = options.windowDays ?? 30;

  const rows = (await executor.execute(sql`
    select
      prompt_name as label,
      sum(estimated_cost_usd)::float as value,
      count(*)::int as sample_size
    from ai_invocations
    where created_at >= now() - (interval '1 day' * ${windowDays})
    group by prompt_name
    order by sum(estimated_cost_usd) desc
  `)) as unknown as BucketRow[];

  return assemble(
    "spend",
    "Model spend by prompt",
    "amount",
    windowDays,
    options.minimumSampleSize,
    rows,
  );
}
