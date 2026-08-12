import { type SQL, sql } from "drizzle-orm";
import {
  type PgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { BusinessOpportunity, Observation, TechnologyEvidence } from "../schemas/evidence";
import { companies } from "./companies";
import { websiteAnalysisOutcomeEnum } from "./enums";

/**
 * One analysis of one company's website at one point in time.
 *
 * Analyses accumulate: a company re-analysed six months later gets a second
 * row, and the pair is the evidence that something changed. Nothing here is
 * updated in place.
 */

/**
 * Scores are nullable because "not measured" is a real outcome — Lighthouse
 * fails on sites that will not load — and storing 0 for it would report a
 * perfect-looking site as catastrophic, or the reverse. The CHECK applies only
 * when a value is present, so NULL stays legal.
 */
function scoreInRange(column: PgColumn): SQL {
  return sql`${column} IS NULL OR (${column} >= 0 AND ${column} <= 100)`;
}

export const websiteAnalysis = pgTable(
  "website_analysis",
  {
    id: uuid("id").primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    // Outcome and failure tracking
    outcome: websiteAnalysisOutcomeEnum("outcome").notNull().default("completed"),
    failureReason: text("failure_reason"),

    // URL analysis details
    analysedUrl: text("analyzed_url").notNull(),
    httpStatus: integer("http_status"),

    // Artifact paths (relative to ANALYSIS_ARTIFACT_ROOT)
    desktopScreenshotPath: text("desktop_screenshot_path"),
    mobileScreenshotPath: text("mobile_screenshot_path"),
    renderedHtmlPath: text("rendered_html_path"),
    auditReportPath: text("audit_report_path"),

    // Unverified override: allows analysis of unverified companies
    unverifiedOverride: boolean("unverified_override").notNull().default(false),

    // Scores (nullable = not measured)
    performanceScore: integer("performance_score"),
    accessibilityScore: integer("accessibility_score"),
    seoScore: integer("seo_score"),
    mobileScore: integer("mobile_score"),
    uxScore: integer("ux_score"),

    // Validated by the Zod schemas in ../schemas/evidence on write and on
    // read. Empty arrays mean "analysed, found nothing"; that is a result.
    technologyStack: jsonb("technology_stack").$type<TechnologyEvidence[]>().notNull().default([]),
    observations: jsonb("observations").$type<Observation[]>().notNull().default([]),
    businessOpportunities: jsonb("business_opportunities")
      .$type<BusinessOpportunity[]>()
      .notNull()
      .default([]),

    summary: text("summary"),

    isExample: boolean("is_example").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Score range checks
    check("website_analysis_performance_score_range", scoreInRange(table.performanceScore)),
    check("website_analysis_accessibility_score_range", scoreInRange(table.accessibilityScore)),
    check("website_analysis_seo_score_range", scoreInRange(table.seoScore)),
    check("website_analysis_mobile_score_range", scoreInRange(table.mobileScore)),
    check("website_analysis_ux_score_range", scoreInRange(table.uxScore)),

    // Failure reason required for non-completed outcomes
    check(
      "website_analysis_failure_reason_required",
      sql`(${table.outcome} = 'completed') OR (${table.failureReason} IS NOT NULL AND ${table.failureReason} != '')`,
    ),

    // No scores on blocked, skipped, or failed analyses
    check(
      "website_analysis_no_scores_on_failure",
      sql`(${table.outcome} IN ('blocked', 'skipped', 'failed')) => (
        ${table.performanceScore} IS NULL AND
        ${table.accessibilityScore} IS NULL AND
        ${table.seoScore} IS NULL AND
        ${table.mobileScore} IS NULL AND
        ${table.uxScore} IS NULL
      )`,
    ),

    // One in-progress analysis per company (partial unique)
    // This is enforced at the application level, not as a DB constraint,
    // because "in-progress" is a transient state.

    // Backs getLatestWebsiteAnalysis (design D6).
    index("website_analysis_company_created_idx").on(table.companyId, table.createdAt.desc()),

    // Backs the staleness query
    index("website_analysis_company_outcome_idx").on(table.companyId, table.outcome),
  ],
);

export type WebsiteAnalysisRow = typeof websiteAnalysis.$inferSelect;
export type WebsiteAnalysisInsert = typeof websiteAnalysis.$inferInsert;
