import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { leadPriorityEnum, leadStatusEnum } from "./enums";

/**
 * A scored company, ready to be worked.
 *
 * The per-component breakdown is stored alongside the total rather than being
 * recomputed on read: the weights are configuration and may be retuned, and a
 * score whose reasoning cannot be reconstructed is an unexplained number.
 * `scoreExplanation` is the human-readable version of the same thing and is
 * required — a score nobody can justify is not usable for outreach.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    leadScore: integer("lead_score").notNull(),
    priority: leadPriorityEnum("priority").notNull(),

    // One column per configured scoring component. Named columns rather than
    // JSONB because the dashboard sorts and filters on them, and because a
    // renamed component should be a visible migration.
    businessFitScore: integer("business_fit_score").notNull(),
    technicalOpportunityScore: integer("technical_opportunity_score").notNull(),
    businessOpportunityScore: integer("business_opportunity_score").notNull(),
    decisionMakerFoundScore: integer("decision_maker_found_score").notNull(),
    companyQualityScore: integer("company_quality_score").notNull(),

    scoreExplanation: text("score_explanation").notNull(),

    // Configuration identifier, validated by the write helpers (design D4).
    recommendedServiceId: text("recommended_service_id"),
    contactReason: text("contact_reason"),

    status: leadStatusEnum("status").notNull(),

    weightVersion: integer("weight_version").notNull(),
    scoredAt: timestamp("scored_at", { withTimezone: true }).notNull().defaultNow(),

    isExample: boolean("is_example").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A company is scored once. A second lead would mean two contradictory
    // opinions about the same company with no way to choose.
    uniqueIndex("leads_company_id_key").on(table.companyId),

    check("leads_lead_score_range", sql`${table.leadScore} >= 0 AND ${table.leadScore} <= 100`),
    check("leads_score_explanation_not_blank", sql`length(btrim(${table.scoreExplanation})) > 0`),

    // Component maximums live in configuration and are enforced by the write
    // helpers, which name the component, the value and the maximum. The
    // database enforces only what cannot change without a migration: a score
    // is never negative and never exceeds the 0-100 scale.
    check(
      "leads_component_scores_range",
      sql`${table.businessFitScore} BETWEEN 0 AND 100
        AND ${table.technicalOpportunityScore} BETWEEN 0 AND 100
        AND ${table.businessOpportunityScore} BETWEEN 0 AND 100
        AND ${table.decisionMakerFoundScore} BETWEEN 0 AND 100
        AND ${table.companyQualityScore} BETWEEN 0 AND 100`,
    ),

    index("leads_priority_idx").on(table.priority),
    index("leads_lead_score_idx").on(table.leadScore.desc()),
    index("leads_status_idx").on(table.status),
    index("leads_weight_version_idx").on(table.weightVersion),
  ],
);

export type LeadRow = typeof leads.$inferSelect;
export type LeadInsert = typeof leads.$inferInsert;
