import { AUTHENTICATION_CONFIG } from "@mela/config";
import type { ApiEnv } from "@mela/config/env";
import {
  type Database,
  type PublicAccountRow,
  findAccountByEmailWithHash,
  findSessionByTokenHash,
  getAccount,
  insertSession,
  revokeSession,
  touchSession,
} from "@mela/database";
import { Inject, Injectable } from "@nestjs/common";

import { API_ENV } from "../config/env.module";
import { DATABASE } from "../database/database.module";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "./password";
import { generateSessionToken, hashSessionToken } from "./session-token";
import { SignInRateLimiter } from "./sign-in-rate-limiter";

/**
 * The one message a failed sign-in ever returns, whether the address is
 * unknown or the password is wrong (design D3) — telling the two apart is
 * exactly what an attacker wants to learn.
 */
export const SIGN_IN_FAILURE_MESSAGE = "Incorrect email or password.";

export const RATE_LIMITED_MESSAGE = "Too many sign-in attempts. Try again later.";

export interface SignInSuccess {
  readonly ok: true;
  readonly account: PublicAccountRow;
  readonly token: string;
  readonly expiresAt: Date;
}

export interface SignInFailure {
  readonly ok: false;
  readonly error: string;
  readonly rateLimited: boolean;
}

export type SignInResult = SignInSuccess | SignInFailure;

export interface AuthenticatedContext {
  readonly account: PublicAccountRow;
  readonly sessionId: string;
}

/**
 * Credentials, sessions and rate limiting (design D2/D3).
 *
 * This service owns the one comparison that matters for the entire feature:
 * whether a request is who it claims to be. Everything downstream — the
 * guard, role checks, attribution — trusts what `validateSessionToken`
 * returns and nothing else.
 */
@Injectable()
export class AuthService {
  private readonly rateLimiter: SignInRateLimiter;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {
    this.rateLimiter = new SignInRateLimiter(
      AUTHENTICATION_CONFIG.rateLimit.windowMinutes * 60_000,
      AUTHENTICATION_CONFIG.rateLimit.maxAttemptsPerAccount,
      AUTHENTICATION_CONFIG.rateLimit.maxAttemptsPerSource,
    );
  }

  async signIn(email: string, password: string, sourceAddress: string): Promise<SignInResult> {
    if (!this.rateLimiter.registerAttempt(email, sourceAddress)) {
      return { ok: false, error: RATE_LIMITED_MESSAGE, rateLimited: true };
    }

    const account = await findAccountByEmailWithHash(this.database, email);

    // Compared even when the account does not exist, against a fixed dummy
    // hash — the branch is which hash gets compared, not whether a
    // comparison happens, so the time this takes does not disclose whether
    // the account exists.
    const hashToCompare = account?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyPassword(hashToCompare, password);

    if (account === undefined || account.disabledAt !== null || !passwordMatches) {
      return { ok: false, error: SIGN_IN_FAILURE_MESSAGE, rateLimited: false };
    }

    this.rateLimiter.reset(email);

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(this.env.SESSION_SECRET, token);
    const expiresAt = this.slidingExpiry(new Date());

    await insertSession(this.database, { accountId: account.id, tokenHash, expiresAt });

    const { passwordHash: _passwordHash, ...publicAccount } = account;

    return { ok: true, account: publicAccount, token, expiresAt };
  }

  /**
   * Validates a raw session token from the cookie: looked up by its hash,
   * rejected if revoked, expired, past its absolute maximum lifetime, or
   * belonging to a disabled account. A valid session's expiry slides forward
   * on every use, capped at the absolute maximum from when it was created.
   */
  async validateSessionToken(rawToken: string): Promise<AuthenticatedContext | null> {
    const tokenHash = hashSessionToken(this.env.SESSION_SECRET, rawToken);
    const session = await findSessionByTokenHash(this.database, tokenHash);

    if (session === undefined || session.revokedAt !== null) {
      return null;
    }

    const now = new Date();
    const absoluteDeadline = new Date(
      session.createdAt.getTime() +
        AUTHENTICATION_CONFIG.sessionAbsoluteMaxLifetimeMinutes * 60_000,
    );

    if (now >= session.expiresAt || now >= absoluteDeadline) {
      return null;
    }

    const account = await getAccount(this.database, session.accountId);

    if (account === undefined || account.disabledAt !== null) {
      return null;
    }

    const nextExpiry = new Date(
      Math.min(this.slidingExpiry(now).getTime(), absoluteDeadline.getTime()),
    );
    await touchSession(this.database, session.id, nextExpiry);

    return { account, sessionId: session.id };
  }

  async signOut(rawToken: string): Promise<void> {
    const tokenHash = hashSessionToken(this.env.SESSION_SECRET, rawToken);
    const session = await findSessionByTokenHash(this.database, tokenHash);

    if (session !== undefined) {
      await revokeSession(this.database, session.id);
    }
  }

  private slidingExpiry(from: Date): Date {
    return new Date(from.getTime() + AUTHENTICATION_CONFIG.sessionLifetimeMinutes * 60_000);
  }
}
