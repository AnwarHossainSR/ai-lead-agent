import { check, index, integer, jsonb, pgTable, sql, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { leads } from "./leads";
import { leadPriorityEnum } from "./enums";

/**
 * One snapshot per scoring run, carrying the component values, the total, the
 * priority, the explanation, the weight version, and identifiers of the evidence
 * the score was computed from. Snapshots accumulate rather than being overwritten.
 */
export const leadScoreSnapshots = pgTable(
  "lead_score_snapshots",
  {
    id: uuid("id").primaryKey(),

    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => leads.companyId, { onDelete: "cascade" }),

    websiteQualityScore: integer("website_quality_score").notNull(),
    technologyFitScore: integer("technology_fit_score").notNull(),
    opportunityScore: integer("opportunity_score").notNull(),
    contactScore: integer("contact_score").notNull(),
    businessFitScore: integer("business_fit_score").notNull(),

    totalScore: integer("total_score").notNull(),
    priority: leadPriorityEnum("priority").notNull(),
    explanation: text("explanation").notNull(),

    weightVersion: integer("weight_version").notNull(),
    evidenceRefs: jsonb("evidence_refs").notNull(),
    missing: jsonb("missing").notNull().default("[]"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("lead_score_snapshots_total_range", sql`${table.totalScore} >= 0 AND ${table.totalScore} <= 100`),
    check(
      "lead_score_snapshots_explanation_not_blank",
      sql`length(btrim(${table.explanation})) > 0`,
    ),
    check(
      "lead_score_snapshots_components_range",
      sql`${table.websiteQualityScore} BETWEEN 0 AND 100
        AND ${table.technologyFitScore} BETWEEN 0 AND 100
        AND ${table.opportunityScore} BETWEEN 0 AND 100
        AND ${table.contactScore} BETWEEN 0 AND 100
        AND ${table.businessFitScore} BETWEEN 0 AND 100`,
    ),
    check(
      "lead_score_snapshots_total_equals_weighted",
      sql`${table.totalScore} = round(${table.websiteQualityScore} * 0.30
        + ${table.technologyFitScore} * 0.30
        + ${table.opportunityScore} * 0.20
        + ${table.contactScore} * 0.10
        + ${table.businessFitScore} * 0.10)`,
    ),
    index("lead_score_snapshots_lead_id_idx").on(table.leadId, table.createdAt),
  ],
);

export type LeadScoreSnapshotRow = typeof leadScoreSnapshots.$inferSelect;
export type LeadScoreSnapshotInsert = typeof leadScoreSnapshots.$inferInsert;
