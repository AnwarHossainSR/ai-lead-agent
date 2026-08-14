import { asc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import { type AccountRow, accounts } from "../schema/accounts";
import { ACCOUNT_ROLES, type AccountRole } from "../schema/enums";
import { databaseNow } from "./clock";
import { RecordNotFoundError, WriteValidationError, isUniqueViolation, parseInput } from "./errors";
import { revokeAllSessionsForAccount } from "./sessions";

/**
 * The write API for operator accounts (design D2/D4).
 *
 * This package never hashes a password — that is Argon2id work living in the
 * API (design D3) — it only stores whatever hash the caller already
 * computed. Every read helper here returns `PublicAccountRow`, which cannot
 * carry a hash because the type does not have the field; `findAccountByEmailWithHash`
 * is the one deliberate exception, reserved for sign-in.
 */

const ACCOUNTS_EMAIL_CONSTRAINT = "accounts_email_key";

export type PublicAccountRow = Omit<AccountRow, "passwordHash">;

function toPublicAccount(row: AccountRow): PublicAccountRow {
  const { passwordHash: _passwordHash, ...rest } = row;
  return rest;
}

export const insertAccountInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Expected a valid email address.")),
  passwordHash: z.string().min(1, "Expected the password hash."),
  role: z.enum(ACCOUNT_ROLES),
});

export type InsertAccountInput = z.input<typeof insertAccountInputSchema>;

/** Creates an account with either role. There is no public path to this — every caller is already an operator or the documented command. */
export async function insertAccount(
  executor: Executor,
  input: InsertAccountInput,
): Promise<PublicAccountRow> {
  const value = parseInput("The account", insertAccountInputSchema, input);

  try {
    const [row] = await executor
      .insert(accounts)
      .values({
        id: uuidv7(),
        email: value.email,
        passwordHash: value.passwordHash,
        role: value.role,
      })
      .returning();

    if (row === undefined) {
      throw new Error("The account insert returned no row.");
    }

    return toPublicAccount(row);
  } catch (error) {
    if (isUniqueViolation(error, ACCOUNTS_EMAIL_CONSTRAINT)) {
      throw new WriteValidationError("The account", [
        `An account with email "${value.email}" already exists.`,
      ]);
    }

    throw error;
  }
}

/**
 * Reads an account by email including its password hash. Sign-in is the one
 * caller allowed to see it — comparing a hash requires having it.
 */
export async function findAccountByEmailWithHash(
  executor: Executor,
  email: string,
): Promise<AccountRow | undefined> {
  const [row] = await executor
    .select()
    .from(accounts)
    .where(eq(accounts.email, email.trim().toLowerCase()))
    .limit(1);

  return row;
}

export async function getAccount(
  executor: Executor,
  accountId: string,
): Promise<PublicAccountRow | undefined> {
  const [row] = await executor.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);

  return row === undefined ? undefined : toPublicAccount(row);
}

export async function listAccounts(executor: Executor): Promise<PublicAccountRow[]> {
  const rows = await executor.select().from(accounts).orderBy(asc(accounts.createdAt));

  return rows.map(toPublicAccount);
}

export async function changeAccountRole(
  executor: Executor,
  accountId: string,
  role: AccountRole,
): Promise<PublicAccountRow> {
  const [row] = await executor
    .update(accounts)
    .set({ role, updatedAt: databaseNow() })
    .where(eq(accounts.id, accountId))
    .returning();

  if (row === undefined) {
    throw new RecordNotFoundError("account", accountId);
  }

  return toPublicAccount(row);
}

/**
 * Disables an account and revokes every session it currently holds, in that
 * order — the spec's "disabling an account ends its sessions" is one
 * requirement, not two independent ones.
 */
export async function disableAccount(
  executor: Executor,
  accountId: string,
): Promise<PublicAccountRow> {
  const [row] = await executor
    .update(accounts)
    .set({ disabledAt: databaseNow(), updatedAt: databaseNow() })
    .where(eq(accounts.id, accountId))
    .returning();

  if (row === undefined) {
    throw new RecordNotFoundError("account", accountId);
  }

  await revokeAllSessionsForAccount(executor, accountId);

  return toPublicAccount(row);
}
