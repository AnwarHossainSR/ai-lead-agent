import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { certaintyEnum } from "./enums";
import { websiteAnalysis } from "./website-analysis";

/**
 * One technology detection from a website analysis.
 *
 * Detections are attached to an analysis and carry the evidence that produced
 * them. A detection with certainty `observed` must have matched text; one with
 * certainty `inferred` must reference the detection that implied it.
 */

export const technologyDetections = pgTable(
  "technology_detections",
  {
    id: uuid("id").primaryKey(),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => websiteAnalysis.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    fingerprintId: text("fingerprint_id").notNull(),
    technologyId: text("technology_id").notNull(),
    category: text("category").notNull(),
    certainty: certaintyEnum("certainty").notNull(),
    matchedIn: text("matched_in"),
    matchedText: text("matched_text"),
    version: text("version"),
    impliedBy: uuid("implied_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One detection per technology per analysis
    unique("technology_detections_analysis_technology_key").on(
      table.analysisId,
      table.technologyId,
    ),

    // Observed detections must have evidence
    check(
      "technology_detections_observed_requires_evidence",
      sql`(${table.certainty} != 'observed') OR (${table.matchedIn} IS NOT NULL AND ${table.matchedText} IS NOT NULL)`,
    ),

    // Inferred detections must reference an implying detection
    check(
      "technology_detections_inferred_requires_implication",
      sql`(${table.certainty} != 'inferred') OR (${table.impliedBy} IS NOT NULL)`,
    ),

    // Backs portfolio count queries
    index("technology_detections_technology_id_idx").on(table.technologyId),

    // Backs latest-analysis-per-company queries
    index("technology_detections_company_created_idx").on(table.companyId, table.createdAt.desc()),
  ],
);

export type TechnologyDetectionRow = typeof technologyDetections.$inferSelect;
export type TechnologyDetectionInsert = typeof technologyDetections.$inferInsert;
