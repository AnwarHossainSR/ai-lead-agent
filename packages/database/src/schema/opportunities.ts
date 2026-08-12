import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { aiInvocations } from "./ai-invocations";
import { companies } from "./companies";
import { certaintyEnum } from "./enums";
import { opportunityAnalysisRuns } from "./opportunity-analysis-runs";

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => opportunityAnalysisRuns.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    categoryId: text("category_id").notNull(),
    serviceId: text("service_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    impact: text("impact").notNull(),
    certainty: certaintyEnum("certainty").notNull().default("inferred"),
    citedEvidence: jsonb("cited_evidence").notNull(),
    aiInvocationId: uuid("ai_invocation_id")
      .notNull()
      .references(() => aiInvocations.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    sql`length(btrim(${table.title})) > 0 and length(btrim(${table.description})) > 0 and length(btrim(${table.impact})) > 0`,
    sql`${jsonb("cited_evidence")}::text && '[]'::text IS NOT NULL`,
    sql`${table.certainty} = 'inferred'`,
    index("opportunities_company_idx").on(table.companyId),
    index("opportunities_category_idx").on(table.categoryId),
    index("opportunities_service_idx").on(table.serviceId),
  ],
);

export type OpportunityRow = typeof opportunities.$inferSelect;
export type OpportunityInsert = typeof opportunities.$inferInsert;
