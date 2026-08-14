import { SESSION_COOKIE_NAME } from "@mela/config";
import { type Database, insertAccount, insertSession } from "@mela/database";
import { accountInput } from "@mela/database/testing/fixtures";

import { generateSessionToken, hashSessionToken } from "../auth/session-token";
import { TEST_SESSION_SECRET } from "./app";

export interface AuthenticatedContext {
  readonly accountId: string;
  readonly role: "operator" | "viewer";
  /** A `Cookie` header value ready for `.set("Cookie", context.cookie)`. */
  readonly cookie: string;
}

/**
 * Creates an account and a valid session directly against the write API —
 * not through sign-in — and returns a `Cookie` header value a supertest
 * request can attach.
 *
 * Every API test now runs behind the global guard (task 4.1), so every one
 * of them needs this. Going through real sign-in for each would mean paying
 * Argon2id's cost per test for a step no test here is actually exercising.
 */
export async function createAuthenticatedContext(
  database: Database,
  role: "operator" | "viewer" = "operator",
  sessionSecret: string = TEST_SESSION_SECRET,
): Promise<AuthenticatedContext> {
  const account = await insertAccount(database, accountInput({ role }));
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(sessionSecret, token);

  await insertSession(database, {
    accountId: account.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  return {
    accountId: account.id,
    role,
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
  };
}
