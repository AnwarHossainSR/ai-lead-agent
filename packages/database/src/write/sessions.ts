import { and, eq, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import { type SessionRow, sessions } from "../schema/sessions";
import { databaseNow } from "./clock";
import { RecordNotFoundError, parseInput } from "./errors";

/**
 * The write API for sessions (design D2).
 *
 * Every function here works against `token_hash`, never a raw token: the
 * hashing happens in the API, where `SESSION_SECRET` lives. This package
 * only ever sees and stores the hash.
 */

export const insertSessionInputSchema = z.object({
  accountId: z.string().uuid("Expected the account identifier."),
  tokenHash: z.string().min(1, "Expected the session token hash."),
  expiresAt: z.coerce.date("Expected the session expiry."),
});

export type InsertSessionInput = z.input<typeof insertSessionInputSchema>;

export async function insertSession(
  executor: Executor,
  input: InsertSessionInput,
): Promise<SessionRow> {
  const value = parseInput("The session", insertSessionInputSchema, input);

  const [row] = await executor
    .insert(sessions)
    .values({
      id: uuidv7(),
      accountId: value.accountId,
      tokenHash: value.tokenHash,
      expiresAt: value.expiresAt,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The session insert returned no row.");
  }

  return row;
}

export async function findSessionByTokenHash(
  executor: Executor,
  tokenHash: string,
): Promise<SessionRow | undefined> {
  const [row] = await executor
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  return row;
}

/** Sliding expiry (design D2): extends `expires_at` and stamps `last_seen_at` on activity, leaving revocation untouched. */
export async function touchSession(
  executor: Executor,
  sessionId: string,
  expiresAt: Date,
): Promise<SessionRow> {
  const [row] = await executor
    .update(sessions)
    .set({ expiresAt, lastSeenAt: databaseNow() })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (row === undefined) {
    throw new RecordNotFoundError("session", sessionId);
  }

  return row;
}

/** Idempotent: revoking an already-revoked session returns it unchanged rather than erroring. */
export async function revokeSession(executor: Executor, sessionId: string): Promise<SessionRow> {
  const [updated] = await executor
    .update(sessions)
    .set({ revokedAt: databaseNow() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
    .returning();

  if (updated !== undefined) {
    return updated;
  }

  const [existing] = await executor
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (existing === undefined) {
    throw new RecordNotFoundError("session", sessionId);
  }

  return existing;
}

export async function revokeAllSessionsForAccount(
  executor: Executor,
  accountId: string,
): Promise<void> {
  await executor
    .update(sessions)
    .set({ revokedAt: databaseNow() })
    .where(and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt)));
}
