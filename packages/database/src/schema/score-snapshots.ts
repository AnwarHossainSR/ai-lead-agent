import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { leads } from "./leads";

export const leadScoreSnapshots = pgTable(
  "lead_score_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    websiteQualityScore: integer("website_quality_score").notNull(),
    technologyFitScore: integer("technology_fit_score").notNull(),
    opportunityScore: integer("opportunity_score").notNull(),
    contactScore: integer("contact_score").notNull(),
    businessFitScore: integer("business_fit_score").notNull(),

    totalScore: integer("total_score").notNull(),
    priority: text("priority").notNull(),

    explanation: text("explanation").notNull(),

    weightVersion: integer("weight_version").notNull(),

    evidenceRefs: text("evidence_refs").notNull(),
    missing: text("missing").notNull().default("[]"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "lead_score_snapshots_explanation_not_blank",
      sql`length(btrim(${table.explanation})) > 0`,
    ),
    check(
      "lead_score_snapshots_total_range",
      sql`${table.totalScore} >= 0 AND ${table.totalScore} <= 100`,
    ),
    check(
      "lead_score_snapshots_total_equals_weighted",
      sql`${table.totalScore} = ${table.websiteQualityScore} + ${table.technologyFitScore} + ${table.opportunityScore} + ${table.contactScore} + ${table.businessFitScore}`,
    ),

    index("lead_score_snapshots_lead_created_idx").on(table.leadId, table.createdAt),
  ],
);

export type LeadScoreSnapshotRow = typeof leadScoreSnapshots.$inferSelect;
export type LeadScoreSnapshotInsert = typeof leadScoreSnapshots.$inferInsert;
