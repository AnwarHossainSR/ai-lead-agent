import { gte, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import { type AIInvocationRow, aiInvocations } from "../schema/ai-invocations";
import { AI_INVOCATION_OUTCOMES } from "../schema/enums";
import { parseInput } from "./errors";

/**
 * The write API for the AI invocation audit trail.
 *
 * Every call path in `@mela/ai` — success, invalid output, provider error,
 * ceiling refusal — writes through `insertAIInvocation` (design D6). There is
 * no update: a retry is a second call and a second row, not an edit to the
 * first.
 */

export const insertAIInvocationInputSchema = z.object({
  promptName: z.string().trim().min(1, "Expected the prompt name."),
  promptVersion: z.number().int().positive("Expected a positive prompt version."),
  model: z.string().trim().min(1, "Expected the model identifier."),
  tier: z.string().trim().min(1, "Expected the tier identifier."),
  inputTokens: z.number().int().min(0, "Expected a non-negative token count."),
  outputTokens: z.number().int().min(0, "Expected a non-negative token count."),
  estimatedCostUsd: z.number().min(0, "Expected a non-negative cost."),
  latencyMs: z.number().int().min(0, "Expected a non-negative latency."),
  attempts: z.number().int().min(1, "Expected at least one attempt."),
  outcome: z.enum(AI_INVOCATION_OUTCOMES),
  failureCode: z
    .string()
    .trim()
    .min(1, "Expected a failure code or nothing at all; a blank string is not a code.")
    .nullish(),
});

export type InsertAIInvocationInput = z.input<typeof insertAIInvocationInputSchema>;

export async function insertAIInvocation(
  executor: Executor,
  input: InsertAIInvocationInput,
): Promise<AIInvocationRow> {
  const value = parseInput("The AI invocation", insertAIInvocationInputSchema, input);

  const [row] = await executor
    .insert(aiInvocations)
    .values({
      id: uuidv7(),
      promptName: value.promptName,
      promptVersion: value.promptVersion,
      model: value.model,
      tier: value.tier,
      inputTokens: value.inputTokens,
      outputTokens: value.outputTokens,
      estimatedCostUsd: value.estimatedCostUsd,
      latencyMs: value.latencyMs,
      attempts: value.attempts,
      outcome: value.outcome,
      failureCode: value.failureCode ?? null,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The AI invocation insert returned no row.");
  }

  return row;
}

/**
 * Sums `estimated_cost_usd` recorded in the last `hours` (design D7).
 *
 * A database query rather than an in-memory counter: the API and the worker
 * are separate processes, and an in-memory counter would give each of them
 * its own ceiling, which is not a ceiling.
 */
export async function spendInWindow(executor: Executor, hours: number): Promise<number> {
  const since = sql`now() - (interval '1 hour' * ${hours})`;

  const [row] = await executor
    .select({ total: sql<string | null>`sum(${aiInvocations.estimatedCostUsd})` })
    .from(aiInvocations)
    .where(gte(aiInvocations.createdAt, since));

  return row?.total === null || row?.total === undefined ? 0 : Number(row.total);
}
