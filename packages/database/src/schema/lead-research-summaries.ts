import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { aiInvocations } from "./ai-invocations";
import { companies } from "./companies";
import { leads } from "./leads";

/**
 * One research summary per generation per lead, carrying the structured
 * sections, the resolved cited facts, the derived unknown list, and the
 * rejection counts when generation failed. Summaries accumulate so
 * regeneration retains history.
 */
export const leadResearchSummaries = pgTable(
  "lead_research_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    sections: jsonb("sections").notNull(),
    citedFacts: jsonb("cited_facts").notNull(),
    unknownFacts: jsonb("unknown_facts").notNull().default("[]"),
    rejections: jsonb("rejections").notNull().default("[]"),

    promptVersion: integer("prompt_version").notNull(),
    aiInvocationId: uuid("ai_invocation_id")
      .notNull()
      .references(() => aiInvocations.id, { onDelete: "restrict" }),

    isGenerated: text("is_generated").notNull().default("true"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("lead_research_summaries_is_generated", sql`${table.isGenerated} = 'true'`),
    check(
      "lead_research_summaries_cited_facts_non_empty",
      sql`jsonb_array_length(${table.citedFacts}) > 0`,
    ),
    index("lead_research_summaries_lead_created_idx").on(
      table.leadId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export type LeadResearchSummaryRow = typeof leadResearchSummaries.$inferSelect;
export type LeadResearchSummaryInsert = typeof leadResearchSummaries.$inferInsert;
