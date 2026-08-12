import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { verificationVerdictEnum } from "./enums";

/**
 * One row per check run per company — the audit trail that makes every
 * verification verdict traceable back to the evidence that produced it.
 *
 * Records accumulate rather than being overwritten: a re-verification run
 * adds new rows, leaving the previous run's evidence inspectable.
 *
 * A passed or failed verdict without evidence is a lie the system refuses
 * to store: the CHECK constraint enforces this at the database level.
 */
export const verificationChecks = pgTable(
  "verification_checks",
  {
    id: uuid("id").primaryKey(),

    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    checkId: text("check_id").notNull(),

    verdict: verificationVerdictEnum("verdict").notNull(),

    // Required evidence for passed/failed; absent (NULL) only for unknown.
    evidence: text("evidence"),
    // Where the evidence can be inspected (URL, registry entry, etc.).
    evidenceUrl: text("evidence_url"),

    // Opaque run identifier grouping checks from the same verification pass.
    verificationRunId: uuid("verification_run_id"),

    ranAt: timestamp("ran_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    // A passed or failed verdict without evidence is meaningless. The
    // database itself enforces this, not application code.
    check(
      "verification_checks_evidence_required",
      sql`(${table.verdict} IN ('passed', 'failed') AND ${table.evidence} IS NOT NULL)
          OR ${table.verdict} = 'unknown'`,
    ),

    // Backs the stale-query and the per-company history page.
    index("verification_checks_company_ran_at_idx").on(table.companyId, table.ranAt.desc()),
  ],
);

export type VerificationCheckRow = typeof verificationChecks.$inferSelect;
export type VerificationCheckInsert = typeof verificationChecks.$inferInsert;
