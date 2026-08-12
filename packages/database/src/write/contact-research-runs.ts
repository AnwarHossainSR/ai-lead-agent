import { uuidv7 } from "uuidv7";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";

import type { Executor } from "../client";
import {
  type ContactResearchRunRow,
  contactResearchRuns,
} from "../schema/contact-research-runs";
import { CONTACT_RESEARCH_OUTCOMES } from "../schema/enums";
import { parseInput } from "./errors";

/**
 * The write API for contact research runs.
 */

export const insertContactResearchRunInputSchema = z.object({
  companyId: z.uuid("Expected the identifier of the company."),

  fetchedPages: z.array(z.string().url()).default([]),
  skippedPages: z
    .array(
      z.object({
        url: z.string().url(),
        reason: z.string().min(1),
      }),
    )
    .default([]),

  outcome: z.enum(CONTACT_RESEARCH_OUTCOMES),

  foundCount: z.number().int().min(0).default(0),
  rejectedCount: z.number().int().min(0).default(0),
  rejectionReasons: z.array(z.string()).default([]),
});

export type InsertContactResearchRunInput = z.input<
  typeof insertContactResearchRunInputSchema
>;

export async function insertContactResearchRun(
  executor: Executor,
  input: InsertContactResearchRunInput,
): Promise<ContactResearchRunRow> {
  const value = parseInput(
    "The contact research run",
    insertContactResearchRunInputSchema,
    input,
  );

  const [row] = await executor
    .insert(contactResearchRuns)
    .values({
      id: uuidv7(),
      companyId: value.companyId,
      fetchedPages: value.fetchedPages,
      skippedPages: value.skippedPages,
      outcome: value.outcome,
      foundCount: value.foundCount,
      rejectedCount: value.rejectedCount,
      rejectionReasons: value.rejectionReasons,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The contact research run insert returned no row.");
  }

  return row;
}

/**
 * Gets the latest contact research runs for a company.
 */
export async function getLatestContactResearchRuns(
  executor: Executor,
  companyId: string,
  limit = 10,
): Promise<readonly ContactResearchRunRow[]> {
  return executor
    .select()
    .from(contactResearchRuns)
    .where(eq(contactResearchRuns.companyId, companyId))
    .orderBy(desc(contactResearchRuns.createdAt))
    .limit(limit);
}
