import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { contactResearchOutcomeEnum } from "./enums";

/**
 * A contact research run.
 *
 * Records what pages were fetched, what was skipped, the outcome,
 * and the number of contacts found and rejected.
 */
export const contactResearchRuns = pgTable(
  "contact_research_runs",
  {
    id: uuid("id").primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Pages that were fetched
    fetchedPages: jsonb("fetched_pages").notNull().default(sql`'[]'::jsonb`),

    // Pages that were skipped with reasons
    skippedPages: jsonb("skipped_pages").notNull().default(sql`'[]'::jsonb`),

    // Outcome of the run
    outcome: contactResearchOutcomeEnum("outcome").notNull(),

    // Number of contacts found
    foundCount: integer("found_count").notNull().default(0),

    // Number of contacts rejected
    rejectedCount: integer("rejected_count").notNull().default(0),

    // Rejection reasons
    rejectionReasons: jsonb("rejection_reasons").notNull().default(sql`'[]'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("contact_research_runs_company_id_idx").on(table.companyId)],
);

export type ContactResearchRunRow = typeof contactResearchRuns.$inferSelect;
export type ContactResearchRunInsert = typeof contactResearchRuns.$inferInsert;
