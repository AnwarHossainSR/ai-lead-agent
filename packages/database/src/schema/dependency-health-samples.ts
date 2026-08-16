import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { dependencyHealthStatusEnum } from "./enums";

/**
 * One reachability sample for one external dependency (design D6).
 *
 * The API status screen's uptime bar has to be drawn from a record or not at
 * all. There is no other source: the log store is not queried by the API, is
 * redacted, and has a retention policy set for a different purpose. So one row
 * per dependency per probe, and the bar renders exactly the rows that exist —
 * a period with no row is drawn as unsampled, never as healthy.
 *
 * The whole row is four values. That is deliberate: anything richer here would
 * be a second, worse copy of the health endpoint's own response.
 */
export const dependencyHealthSamples = pgTable(
  "dependency_health_samples",
  {
    id: uuid("id").primaryKey(),

    /** The dependency's name, matching the health endpoint's key: `postgres`, `redis`. */
    dependency: text("dependency").notNull(),

    status: dependencyHealthStatusEnum("status").notNull(),

    /**
     * How long the probe took, in milliseconds. NULL when the dependency did
     * not answer at all — a latency of zero would read as instantaneous.
     */
    latencyMs: integer("latency_ms"),

    /** Why it was not up. NULL when it was. */
    failureReason: text("failure_reason"),

    sampledAt: timestamp("sampled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The bar reads one dependency's window, newest first.
    index("dependency_health_samples_dependency_sampled_idx").on(table.dependency, table.sampledAt),

    // A dependency that answered has a latency; one that did not, does not.
    check(
      "dependency_health_samples_latency_pairs_with_answer",
      sql`(${table.status} = 'down') = (${table.latencyMs} IS NULL)`,
    ),

    // `up` is the only status that needs no explanation.
    check(
      "dependency_health_samples_failure_has_reason",
      sql`(${table.status} = 'up') = (${table.failureReason} IS NULL)`,
    ),
  ],
);

export type DependencyHealthSampleRow = typeof dependencyHealthSamples.$inferSelect;
export type DependencyHealthSampleInsert = typeof dependencyHealthSamples.$inferInsert;
