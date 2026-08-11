import { type SQL, sql } from "drizzle-orm";
import {
  type PgColumn,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { aiInvocationOutcomeEnum } from "./enums";

/**
 * One record per language model call (design D6) — the audit trail that
 * makes an AI-derived fact traceable back to the call that produced it.
 * Never updated: a retry or a repair attempt is its own row, not an edit to
 * this one.
 *
 * Carries no prompt text, no response text and no credential — only what is
 * needed to answer "what was asked, of which model, what did it cost, and
 * what happened".
 */
function nonNegative(column: PgColumn): SQL {
  return sql`${column} >= 0`;
}

export const aiInvocations = pgTable(
  "ai_invocations",
  {
    id: uuid("id").primaryKey(),

    promptName: text("prompt_name").notNull(),
    promptVersion: integer("prompt_version").notNull(),
    model: text("model").notNull(),
    tier: text("tier").notNull(),

    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    // Estimated, not billed — the column name says so (design D6). Numeric
    // rather than a float column so accumulation across many rows does not
    // drift; mode "number" because six decimal places of USD never
    // approaches JS's safe integer range.
    estimatedCostUsd: numeric("estimated_cost_usd", {
      precision: 10,
      scale: 6,
      mode: "number",
    }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    attempts: integer("attempts").notNull(),

    outcome: aiInvocationOutcomeEnum("outcome").notNull(),
    failureCode: text("failure_code"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("ai_invocations_input_tokens_non_negative", nonNegative(table.inputTokens)),
    check("ai_invocations_output_tokens_non_negative", nonNegative(table.outputTokens)),
    check("ai_invocations_estimated_cost_non_negative", nonNegative(table.estimatedCostUsd)),
    check("ai_invocations_latency_non_negative", nonNegative(table.latencyMs)),
    check("ai_invocations_attempts_positive", sql`${table.attempts} >= 1`),

    // Backs spendInWindow (design D7): sums estimated_cost_usd since a point
    // in time.
    index("ai_invocations_created_at_idx").on(table.createdAt),
  ],
);

export type AIInvocationRow = typeof aiInvocations.$inferSelect;
export type AIInvocationInsert = typeof aiInvocations.$inferInsert;
