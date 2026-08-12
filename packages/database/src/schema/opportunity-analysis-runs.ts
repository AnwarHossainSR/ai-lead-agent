import { pgEnum, pgTable, text, timestamp, integer, uuid, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { opportunityAnalysisOutcomeEnum } from "./enums";
import { aiInvocationEnum } from "./ai-invocations";
import { companies } from "./companies";
import { websiteAnalysis } from "./website-analysis";
import { certaintyEnum } from "./enums";

export const opportunityAnalysisRuns = pgTable(
  "opportunity_analysis_runs",
  {
    id: uuid("id").primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    websiteAnalysisId: uuid("website_analysis_id").references(
      () => websiteAnalysis.id,
      { onDelete: "set null" },
    ),
    promptVersion: integer("prompt_version").notNull(),
    outcome: opportunityAnalysisOutcomeEnum("outcome").notNull(),
    acceptedCount: integer("accepted_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    rejections: jsonb("rejections").notNull().default("[]"),
    aiInvocationId: uuid("ai_invocation_id")
      .notNull()
      .references(() => aiInvocationEnum, { onDelete: "restrict" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    sql`check(${table.outcome} <> 'opportunities' or ${table.acceptedCount} > 0)`,
    index("opportunity_analysis_runs_company_idx").on(table.companyId),
    index("opportunity_analysis_runs_outcome_idx").on(table.outcome),
  ],
);

export type OpportunityAnalysisRunRow = typeof opportunityAnalysisRuns.$inferSelect;
export type OpportunityAnalysisRunInsert = typeof opportunityAnalysisRuns.$inferInsert;