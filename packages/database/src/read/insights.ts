import { type SQL, sql } from "drizzle-orm";

import type { Executor } from "../client";

/**
 * The dashboard's aggregate reads (design D4).
 *
 * Counting happens in SQL, in one round trip per shape, rather than by pulling
 * rows into the API and reducing them. The dashboard needs four counts, four
 * seven-point series, a nine-stage funnel, an activity feed and an attention
 * list; assembled row by row that is the page taking four seconds.
 *
 * Two rules run through every query here and are worth stating once:
 *
 * - **`null` is not zero.** A previous period that predates the workspace, a
 *   stage that has never run, an actor for something the system did on its own
 *   — each returns `null`, and the interface renders each as its own state.
 * - **A day nobody recorded is absent; a day recorded as nothing is a zero.**
 *   The series below emits a point for every day from the first record onward,
 *   including days with no activity, and emits nothing for days before the
 *   first record. That is what lets a sparkline say "5 of 7 days recorded"
 *   truthfully.
 */

export interface SeriesPoint {
  /** The day the value covers, as `YYYY-MM-DD`. */
  readonly at: string;
  readonly value: number;
}

export interface MetricSeries {
  readonly current: number;
  /**
   * The preceding period's count, or `null` when the workspace was not
   * recording for the whole of that period — a new workspace's first week has
   * no prior week, and reporting that as `+100%` is the lie design D5 exists
   * to prevent.
   */
  readonly previous: number | null;
  readonly points: readonly SeriesPoint[];
  /** The first day this metric holds any record for, or `null` for none. */
  readonly firstRecordedAt: string | null;
}

export interface DashboardSummary {
  readonly windowDays: number;
  readonly companiesDiscovered: MetricSeries;
  readonly leadsScored: MetricSeries;
  readonly draftsWritten: MetricSeries;
  readonly outreachApproved: MetricSeries;
}

interface MetricRow {
  readonly current: number | string;
  readonly previous: number | string | null;
  readonly first_recorded_at: string | null;
  readonly points: readonly { at: string; value: number | string }[];
}

/**
 * One metric's current count, its comparison and its daily series.
 *
 * `source` is a `select <timestamp> as at from <table> where …` fragment: what
 * differs between the four headline metrics is only which rows count and which
 * column dates them, so the honesty rules live here once rather than four
 * times.
 */
async function metricSeries(
  executor: Executor,
  source: SQL,
  now: Date,
  windowDays: number,
): Promise<MetricSeries> {
  const rows = (await executor.execute(sql`
    with bounds as (
      select
        ${now.toISOString()}::timestamptz as at_now,
        ${now.toISOString()}::timestamptz - (interval '1 day' * ${windowDays}) as window_start,
        ${now.toISOString()}::timestamptz - (interval '1 day' * ${windowDays * 2}) as previous_start
    ),
    source as (${source}),
    first_record as (select min(at) as first_at from source),
    current_count as (
      select count(*)::int as value
      from source, bounds
      where source.at >= bounds.window_start and source.at <= bounds.at_now
    ),
    previous_count as (
      select count(*)::int as value
      from source, bounds
      where source.at >= bounds.previous_start and source.at < bounds.window_start
    ),
    days as (
      select generate_series(
        date_trunc('day', bounds.window_start),
        date_trunc('day', bounds.at_now),
        interval '1 day'
      ) as day
      from bounds
    ),
    counted as (
      select days.day, count(source.at)::int as value
      from days
      left join source on date_trunc('day', source.at) = days.day
      group by days.day
    )
    select
      (select value from current_count) as current,
      case
        when (select first_at from first_record) is null
          or (select first_at from first_record) > (select previous_start from bounds)
        then null
        else (select value from previous_count)
      end as previous,
      to_char((select first_at from first_record), 'YYYY-MM-DD') as first_recorded_at,
      coalesce(
        (
          select json_agg(
            json_build_object('at', to_char(counted.day, 'YYYY-MM-DD'), 'value', counted.value)
            order by counted.day
          )
          from counted, first_record
          where first_record.first_at is not null
            and counted.day >= date_trunc('day', first_record.first_at)
        ),
        '[]'::json
      ) as points
  `)) as unknown as MetricRow[];

  const row = rows[0];
  if (row === undefined) {
    // Only reachable if the statement returned no row at all, which the shape
    // above cannot do — stated rather than assumed.
    return { current: 0, previous: null, points: [], firstRecordedAt: null };
  }

  return {
    current: Number(row.current),
    previous: row.previous === null ? null : Number(row.previous),
    points: row.points.map((point) => ({ at: point.at, value: Number(point.value) })),
    firstRecordedAt: row.first_recorded_at,
  };
}

/**
 * The four headline counts, each with its comparison and its series.
 *
 * All four are *events* rather than standing states: a state ("drafts awaiting
 * review") has no per-day series and no previous-period equivalent, so putting
 * one on a trend card would mean inventing both. Standing states belong to the
 * attention list below.
 */
export async function readDashboardSummary(
  executor: Executor,
  options: { readonly now?: Date; readonly windowDays?: number } = {},
): Promise<DashboardSummary> {
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? 7;

  const [companiesDiscovered, leadsScored, draftsWritten, outreachApproved] = await Promise.all([
    metricSeries(executor, sql`select created_at as at from companies`, now, windowDays),
    metricSeries(executor, sql`select scored_at as at from leads`, now, windowDays),
    metricSeries(executor, sql`select created_at as at from outreach`, now, windowDays),
    metricSeries(
      executor,
      sql`select approved_at as at from outreach where approved_at is not null`,
      now,
      windowDays,
    ),
  ]);

  return { windowDays, companiesDiscovered, leadsScored, draftsWritten, outreachApproved };
}

export interface FunnelStage {
  readonly id: string;
  readonly label: string;
  /**
   * How many companies have reached this stage, or `null` when the stage has
   * never been executed for any company. A stage that ran and carried nobody
   * forward reports `0`; the two are different facts.
   */
  readonly count: number | null;
}

/**
 * Each stage, the rows that prove a company reached it, and the rows that
 * prove the stage ran at all.
 *
 * `reached` and `ran` are separate on purpose: technology detection that ran
 * against fifty companies and matched nothing has `ran` rows but no `reached`
 * rows, and reports `0`. Technology detection that was never invoked has
 * neither, and reports "not run".
 */
const FUNNEL_STAGES: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  readonly reached: SQL;
  readonly ran: SQL;
}> = [
  {
    id: "discovered",
    label: "Discovered",
    reached: sql`select id as company_id from companies`,
    ran: sql`select 1 from companies limit 1`,
  },
  {
    id: "verified",
    label: "Verified",
    reached: sql`select id as company_id from companies where verification_state = 'verified'`,
    ran: sql`select 1 from verification_checks limit 1`,
  },
  {
    id: "website_analysed",
    label: "Website analysed",
    reached: sql`select distinct company_id from website_analysis where outcome in ('completed', 'partial')`,
    ran: sql`select 1 from website_analysis limit 1`,
  },
  {
    id: "technology_detected",
    label: "Technology detected",
    reached: sql`select distinct company_id from technology_detections`,
    ran: sql`select 1 from website_analysis where outcome in ('completed', 'partial') limit 1`,
  },
  {
    id: "opportunities",
    label: "Opportunities found",
    reached: sql`select distinct company_id from opportunities`,
    ran: sql`select 1 from opportunity_analysis_runs limit 1`,
  },
  {
    id: "contacts",
    label: "Contacts researched",
    reached: sql`select distinct company_id from contacts`,
    ran: sql`select 1 from contact_research_runs limit 1`,
  },
  {
    id: "scored",
    label: "Scored",
    reached: sql`select distinct company_id from leads`,
    ran: sql`select 1 from leads limit 1`,
  },
  {
    id: "summarised",
    label: "Research summarised",
    reached: sql`select distinct company_id from lead_research_summaries`,
    ran: sql`select 1 from lead_research_summaries limit 1`,
  },
  {
    id: "drafted",
    label: "Outreach drafted",
    reached: sql`select distinct leads.company_id from outreach join leads on leads.id = outreach.lead_id`,
    ran: sql`select 1 from outreach limit 1`,
  },
];

/**
 * Companies by the furthest stage they reached.
 *
 * Counts are cumulative — a company that reached scoring is counted at every
 * earlier stage too — so the funnel narrows and no stage can report more
 * companies than exist (spec: the funnel does not exceed its source).
 */
export async function readFunnel(executor: Executor): Promise<readonly FunnelStage[]> {
  const parts = FUNNEL_STAGES.map(
    (stage) => sql`select
      ${stage.id} as id,
      (select count(*)::int from (${stage.reached}) as reached) as reached_count,
      exists(${stage.ran}) as ever_ran`,
  );

  const union = sql.join(parts, sql` union all `);
  const rows = (await executor.execute(sql`${union}`)) as unknown as ReadonlyArray<{
    id: string;
    reached_count: number | string;
    ever_ran: boolean;
  }>;

  const byId = new Map(rows.map((row) => [row.id, row]));

  return FUNNEL_STAGES.map((stage) => {
    const row = byId.get(stage.id);
    return {
      id: stage.id,
      label: stage.label,
      count: row === undefined || row.ever_ran !== true ? null : Number(row.reached_count),
    };
  });
}

export interface ActivityEntry {
  readonly id: string;
  /** The account that caused it, or `null` for something the system did. */
  readonly actor: string | null;
  readonly action: string;
  readonly subject: string | null;
  readonly subjectType: string | null;
  readonly subjectId: string | null;
  readonly outcome: string;
  /** ISO 8601. */
  readonly at: string;
}

/**
 * Recent workspace events from the audit trail.
 *
 * The audit trail is the only source here: it is the record of what was
 * actually done, and anything assembled from elsewhere would be this module
 * narrating events rather than reporting them (spec: recent activity is drawn
 * from what was recorded, not narrated).
 *
 * `actor` is the account's email or `null`. Null survives all the way to the
 * interface, which renders "System" — never the signed-in account, which did
 * not do it.
 */
export async function readActivity(
  executor: Executor,
  options: { readonly limit?: number } = {},
): Promise<readonly ActivityEntry[]> {
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 100);

  const rows = (await executor.execute(sql`
    select
      audit_log.id::text as id,
      accounts.email as actor,
      audit_log.event as action,
      audit_log.subject_type as subject_type,
      audit_log.subject_id::text as subject_id,
      audit_log.outcome as outcome,
      coalesce(companies.name, lead_companies.name) as subject,
      to_char(audit_log.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at
    from audit_log
    left join accounts on accounts.id = audit_log.account_id
    left join companies on audit_log.subject_type = 'company' and companies.id = audit_log.subject_id
    left join leads on audit_log.subject_type = 'lead' and leads.id = audit_log.subject_id
    left join companies as lead_companies on lead_companies.id = leads.company_id
    order by audit_log.created_at desc
    limit ${limit}
  `)) as unknown as ReadonlyArray<{
    id: string;
    actor: string | null;
    action: string;
    subject_type: string | null;
    subject_id: string | null;
    outcome: string;
    subject: string | null;
    at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    actor: row.actor,
    action: row.action,
    subject: row.subject,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    outcome: row.outcome,
    at: row.at,
  }));
}

export interface AttentionItem {
  readonly id: string;
  readonly kind: "drafts_awaiting_review" | "failed_stage" | "stale_leads" | "unreachable_company";
  readonly label: string;
  readonly count: number;
  /** Where the reader goes to deal with it. */
  readonly href: string;
  /** How long the oldest of them has been waiting, ISO 8601, or `null`. */
  readonly oldestAt: string | null;
}

/**
 * Everything waiting on a person, as one ordered list.
 *
 * Ordered by what it costs to leave alone: a draft nobody has read blocks the
 * only path to revenue, a failed stage is work the pipeline already paid for
 * and lost, staleness is a slow decay. An item with a count of zero is omitted
 * rather than listed as clear — the empty list is itself the statement that
 * nothing needs attention (spec: nothing needs attention).
 */
export async function readAttention(
  executor: Executor,
  options: { readonly stalenessDays?: number } = {},
): Promise<readonly AttentionItem[]> {
  const stalenessDays = options.stalenessDays ?? 30;

  const rows = (await executor.execute(sql`
    select 'drafts_awaiting_review' as kind, count(*)::int as count,
           to_char(min(created_at) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as oldest_at
    from outreach where status in ('draft', 'pending_approval')
    union all
    select 'failed_stage', count(*)::int,
           to_char(min(created_at) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    from website_analysis where outcome in ('failed', 'blocked')
    union all
    select 'stale_leads', count(*)::int,
           to_char(min(scored_at) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    from leads where scored_at < now() - (interval '1 day' * ${stalenessDays})
    union all
    select 'unreachable_company', count(*)::int,
           to_char(min(updated_at) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    from companies where verification_state = 'unreachable'
  `)) as unknown as ReadonlyArray<{
    kind: AttentionItem["kind"];
    count: number | string;
    oldest_at: string | null;
  }>;

  const describe: Record<
    AttentionItem["kind"],
    { readonly label: (count: number) => string; readonly href: string }
  > = {
    drafts_awaiting_review: {
      label: (count) => `${count} draft${count === 1 ? "" : "s"} awaiting review`,
      href: "/outreach/review",
    },
    failed_stage: {
      label: (count) => `${count} website analys${count === 1 ? "is" : "es"} failed or blocked`,
      href: "/companies/needs-attention",
    },
    stale_leads: {
      label: (count) =>
        `${count} lead${count === 1 ? "" : "s"} scored more than ${stalenessDays} days ago`,
      href: "/leads?staleness=stale",
    },
    unreachable_company: {
      label: (count) => `${count} compan${count === 1 ? "y" : "ies"} unreachable`,
      href: "/companies/needs-attention",
    },
  };

  const order: ReadonlyArray<AttentionItem["kind"]> = [
    "drafts_awaiting_review",
    "failed_stage",
    "unreachable_company",
    "stale_leads",
  ];

  const byKind = new Map(rows.map((row) => [row.kind, row]));

  return order.flatMap((kind) => {
    const row = byKind.get(kind);
    const count = row === undefined ? 0 : Number(row.count);
    if (count === 0) return [];

    return [
      {
        id: kind,
        kind,
        label: describe[kind].label(count),
        count,
        href: describe[kind].href,
        oldestAt: row?.oldest_at ?? null,
      },
    ];
  });
}
