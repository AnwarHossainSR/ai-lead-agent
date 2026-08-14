import { and, desc, eq, gte, lte } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import { type AuditLogRow, auditLog } from "../schema/audit-log";
import { parseInput } from "./errors";

/**
 * The write API for the audit log (design D6).
 *
 * There is deliberately no update or delete function here. The table itself
 * refuses both via a trigger, but "the write API offers no such call" is the
 * first line of defence — nobody reaching for an update has anywhere to
 * reach.
 */

export const insertAuditEntryInputSchema = z.object({
  accountId: z.string().uuid("Expected the account identifier.").nullish(),
  event: z.string().trim().min(1, "Expected the audit event name."),
  subjectType: z.string().trim().min(1, "Expected a subject type or nothing at all.").nullish(),
  subjectId: z.string().uuid("Expected the subject identifier.").nullish(),
  outcome: z.string().trim().min(1, "Expected the audit outcome."),
  sourceAddress: z.string().trim().min(1, "Expected a source address or nothing at all.").nullish(),
  detail: z.record(z.string(), z.unknown()).default({}),
});

export type InsertAuditEntryInput = z.input<typeof insertAuditEntryInputSchema>;

export async function insertAuditEntry(
  executor: Executor,
  input: InsertAuditEntryInput,
): Promise<AuditLogRow> {
  const value = parseInput("The audit entry", insertAuditEntryInputSchema, input);

  const [row] = await executor
    .insert(auditLog)
    .values({
      id: uuidv7(),
      accountId: value.accountId ?? null,
      event: value.event,
      subjectType: value.subjectType ?? null,
      subjectId: value.subjectId ?? null,
      outcome: value.outcome,
      sourceAddress: value.sourceAddress ?? null,
      detail: value.detail,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The audit log insert returned no row.");
  }

  return row;
}

export interface AuditLogFilters {
  readonly event?: string;
  readonly accountId?: string;
  readonly since?: Date;
  readonly until?: Date;
  readonly limit?: number;
}

/** Newest first, so the most recent activity is what an operator sees first. */
export async function listAuditEntries(
  executor: Executor,
  filters?: AuditLogFilters,
): Promise<AuditLogRow[]> {
  const conditions = [];

  if (filters?.event !== undefined) {
    conditions.push(eq(auditLog.event, filters.event));
  }
  if (filters?.accountId !== undefined) {
    conditions.push(eq(auditLog.accountId, filters.accountId));
  }
  if (filters?.since !== undefined) {
    conditions.push(gte(auditLog.createdAt, filters.since));
  }
  if (filters?.until !== undefined) {
    conditions.push(lte(auditLog.createdAt, filters.until));
  }

  let query = executor
    .select()
    .from(auditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.createdAt));

  if (filters?.limit !== undefined) {
    query = query.limit(filters.limit) as typeof query;
  }

  return query;
}
