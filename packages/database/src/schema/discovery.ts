import { type SQL, sql } from "drizzle-orm";
import {
  type PgColumn,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { discoveryRunOutcomeEnum, discoverySourceOutcomeEnum } from "./enums";

function nonNegative(column: PgColumn): SQL {
  return sql`${column} >= 0`;
}

/**
 * One discovery run — what was searched, what bounded it, and how it ended
 * (design D6). Country, city and industry are configuration identifiers stored
 * as `text` exactly like `companies`; the write helpers validate them against
 * `@mela/config`.
 *
 * `discovery_run_id` on `companies` points here `ON DELETE SET NULL`: deleting
 * a run is housekeeping and must never take the companies it found with it.
 */
export const discoveryRuns = pgTable(
  "discovery_runs",
  {
    id: uuid("id").primaryKey(),
    countryId: text("country_id").notNull(),
    cityId: text("city_id"),
    industryId: text("industry_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    outcome: discoveryRunOutcomeEnum("outcome").notNull(),
    candidateLimit: integer("candidate_limit").notNull(),
    durationLimitSeconds: integer("duration_limit_seconds").notNull(),
    failureReason: text("failure_reason"),
  },
  (table) => [
    check(
      "discovery_runs_finished_at_after_started_at",
      sql`${table.finishedAt} IS NULL OR ${table.finishedAt} >= ${table.startedAt}`,
    ),
    check("discovery_runs_candidate_limit_positive", sql`${table.candidateLimit} >= 1`),
    check("discovery_runs_duration_limit_positive", sql`${table.durationLimitSeconds} >= 1`),

    // One run in progress per (country, industry): a partial index on outcome
    // = 'running'. Two people cannot start the same discovery twice, and the
    // refusal surfaces before a second run burns rate-limited requests.
    uniqueIndex("discovery_runs_one_running_per_territory")
      .on(table.countryId, table.industryId)
      .where(sql`${table.outcome} = 'running'`),

    // Backs "list runs" and the dashboard.
    index("discovery_runs_started_at_idx").on(table.startedAt),
  ],
);

/**
 * What a run saw, per source (design D6). The counts are the run's honest
 * report — returned, stored, duplicated, rejected — and the rejections carry
 * the reasons so "rejected because no source URL" is distinguishable from
 * "rejected because the row was malformed".
 */
export const discoveryRunSources = pgTable(
  "discovery_run_sources",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => discoveryRuns.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    outcome: discoverySourceOutcomeEnum("outcome").notNull(),
    returnedCount: integer("returned_count").notNull().default(0),
    storedCount: integer("stored_count").notNull().default(0),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    rejections: jsonb("rejections").notNull().default(sql`'[]'::jsonb`),
    note: text("note"),
  },
  (table) => [
    uniqueIndex("discovery_run_sources_run_source_key").on(table.runId, table.sourceId),
    check("discovery_run_sources_returned_non_negative", nonNegative(table.returnedCount)),
    check("discovery_run_sources_stored_non_negative", nonNegative(table.storedCount)),
    check("discovery_run_sources_duplicate_non_negative", nonNegative(table.duplicateCount)),
    check("discovery_run_sources_rejected_non_negative", nonNegative(table.rejectedCount)),
  ],
);

/**
 * Every distinct source that has produced a given company, with the URL the
 * claim was found at. `last_seen_at` is advanced on rediscovery; the composite
 * primary key is what makes "same source, same company, twice" one row.
 */
export const companyDiscoverySources = pgTable(
  "company_discovery_sources",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.companyId, table.sourceId] }),
    check(
      "company_discovery_sources_source_url_not_blank",
      sql`length(trim(${table.sourceUrl})) > 0`,
    ),
  ],
);

export type DiscoveryRunRow = typeof discoveryRuns.$inferSelect;
export type DiscoveryRunInsert = typeof discoveryRuns.$inferInsert;
export type DiscoveryRunSourceRow = typeof discoveryRunSources.$inferSelect;
export type DiscoveryRunSourceInsert = typeof discoveryRunSources.$inferInsert;
export type CompanyDiscoverySourceRow = typeof companyDiscoverySources.$inferSelect;
export type CompanyDiscoverySourceInsert = typeof companyDiscoverySources.$inferInsert;
