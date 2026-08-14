import { AUTHENTICATION_CONFIG } from "@mela/config";
import { insertAccount, sessions } from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { accountInput } from "@mela/database/testing/fixtures";
import { Test } from "@nestjs/testing";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { API_ENV } from "../config/env.module";
import { DATABASE } from "../database/database.module";
import { AuthService, RATE_LIMITED_MESSAGE, SIGN_IN_FAILURE_MESSAGE } from "./auth.service";
import { hashPassword } from "./password";

const TEST_SESSION_SECRET = "test-suite-session-secret-0123456789ab";
const KNOWN_PASSWORD = "a-strong-password-123";

let harness: TestDatabase;

async function buildService(): Promise<AuthService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      { provide: DATABASE, useValue: harness.database },
      { provide: API_ENV, useValue: { SESSION_SECRET: TEST_SESSION_SECRET, NODE_ENV: "test" } },
      AuthService,
    ],
  }).compile();

  return moduleRef.get(AuthService);
}

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
});

afterAll(async () => {
  await harness.close();
});

describe("AuthService.signIn", () => {
  let service: AuthService;

  beforeEach(async () => {
    service = await buildService();
  });

  it("succeeds for the right email and password, issuing a session", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    const account = await insertAccount(
      harness.database,
      accountInput({ email: "operator@example.com", passwordHash, role: "operator" }),
    );

    const result = await service.signIn("operator@example.com", KNOWN_PASSWORD, "1.1.1.1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.account.id).toBe(account.id);
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("fails with the generic message for an unknown email", async () => {
    const result = await service.signIn("nobody@example.com", "irrelevant", "1.1.1.1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(SIGN_IN_FAILURE_MESSAGE);
    }
  });

  it("fails with the same generic message for a wrong password on a known account", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    await insertAccount(
      harness.database,
      accountInput({ email: "known@example.com", passwordHash }),
    );

    const result = await service.signIn("known@example.com", "wrong-password", "1.1.1.1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(SIGN_IN_FAILURE_MESSAGE);
    }
  });

  it("takes comparable time for an unknown email and a wrong password", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    await insertAccount(
      harness.database,
      accountInput({ email: "timing@example.com", passwordHash }),
    );

    const unknownStart = performance.now();
    await service.signIn("no-such-account@example.com", "wrong-password", "2.2.2.1");
    const unknownElapsed = performance.now() - unknownStart;

    const knownStart = performance.now();
    await service.signIn("timing@example.com", "wrong-password", "2.2.2.2");
    const knownElapsed = performance.now() - knownStart;

    // Both perform one Argon2id comparison at the same parameters — this is
    // a loose sanity bound, not a timing-attack proof.
    expect(unknownElapsed).toBeLessThan(knownElapsed * 5 + 200);
    expect(knownElapsed).toBeLessThan(unknownElapsed * 5 + 200);
  });

  it("refuses a disabled account even with the correct password", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    const account = await insertAccount(
      harness.database,
      accountInput({ email: "disabled@example.com", passwordHash }),
    );
    // Directly, since disabling is the domain of the accounts write API
    // tested elsewhere — this test only needs a disabled row.
    await harness.database.execute(
      sql`UPDATE accounts SET disabled_at = now() WHERE id = ${account.id}`,
    );

    const result = await service.signIn("disabled@example.com", KNOWN_PASSWORD, "1.1.1.1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(SIGN_IN_FAILURE_MESSAGE);
    }
  });

  it("throttles repeated failures for one account without blocking another", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    await insertAccount(
      harness.database,
      accountInput({ email: "throttled@example.com", passwordHash }),
    );
    await insertAccount(
      harness.database,
      accountInput({ email: "other@example.com", passwordHash }),
    );

    const { maxAttemptsPerAccount } = AUTHENTICATION_CONFIG.rateLimit;
    let lastResult = await service.signIn("throttled@example.com", "wrong", "3.3.3.1");
    for (let attempt = 1; attempt < maxAttemptsPerAccount; attempt += 1) {
      lastResult = await service.signIn("throttled@example.com", "wrong", "3.3.3.1");
    }
    expect(lastResult.ok).toBe(false);

    // One more, past the limit, is refused for being throttled rather than
    // for the credential itself — even though the credential is also wrong.
    const throttled = await service.signIn("throttled@example.com", "wrong", "3.3.3.1");

    expect(throttled.ok).toBe(false);
    if (!throttled.ok) {
      expect(throttled.rateLimited).toBe(true);
      expect(throttled.error).toBe(RATE_LIMITED_MESSAGE);
    }

    const other = await service.signIn("other@example.com", KNOWN_PASSWORD, "3.3.3.2");
    expect(other.ok).toBe(true);
  });
});

describe("AuthService session lifecycle", () => {
  let service: AuthService;

  beforeEach(async () => {
    service = await buildService();
  });

  it("validates a session issued by a successful sign-in", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    const account = await insertAccount(
      harness.database,
      accountInput({ email: "session@example.com", passwordHash }),
    );

    const signIn = await service.signIn("session@example.com", KNOWN_PASSWORD, "1.1.1.1");
    expect(signIn.ok).toBe(true);
    if (!signIn.ok) return;

    const validated = await service.validateSessionToken(signIn.token);

    expect(validated?.account.id).toBe(account.id);
  });

  it("rejects an unknown token", async () => {
    const validated = await service.validateSessionToken("not-a-real-token");

    expect(validated).toBeNull();
  });

  it("rejects a session after sign-out", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    await insertAccount(
      harness.database,
      accountInput({ email: "signout@example.com", passwordHash }),
    );

    const signIn = await service.signIn("signout@example.com", KNOWN_PASSWORD, "1.1.1.1");
    if (!signIn.ok) throw new Error("expected sign-in to succeed");

    await service.signOut(signIn.token);
    const validated = await service.validateSessionToken(signIn.token);

    expect(validated).toBeNull();
  });

  it("rejects a session whose expiry has passed", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    await insertAccount(
      harness.database,
      accountInput({ email: "expired@example.com", passwordHash }),
    );

    const signIn = await service.signIn("expired@example.com", KNOWN_PASSWORD, "1.1.1.1");
    if (!signIn.ok) throw new Error("expected sign-in to succeed");

    // Only the one session this test created exists after `truncate()`, so
    // an unconditional update reaches exactly that row.
    await harness.database.execute(
      sql`UPDATE sessions SET expires_at = now() - interval '1 minute'`,
    );

    const validated = await service.validateSessionToken(signIn.token);

    expect(validated).toBeNull();
  });

  it("rejects a session past its absolute maximum lifetime even though sliding expiry alone would still permit it", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    await insertAccount(
      harness.database,
      accountInput({ email: "stale@example.com", passwordHash }),
    );

    const signIn = await service.signIn("stale@example.com", KNOWN_PASSWORD, "1.1.1.1");
    if (!signIn.ok) throw new Error("expected sign-in to succeed");

    const beyondAbsoluteMax = AUTHENTICATION_CONFIG.sessionAbsoluteMaxLifetimeMinutes + 60;
    await harness.database.execute(
      sql`UPDATE sessions SET created_at = now() - (${beyondAbsoluteMax} || ' minutes')::interval, expires_at = now() + interval '1 hour'`,
    );

    const validated = await service.validateSessionToken(signIn.token);

    expect(validated).toBeNull();
  });

  it("extends the expiry on a successful validation (sliding expiry)", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    await insertAccount(
      harness.database,
      accountInput({ email: "sliding@example.com", passwordHash }),
    );

    const signIn = await service.signIn("sliding@example.com", KNOWN_PASSWORD, "1.1.1.1");
    if (!signIn.ok) throw new Error("expected sign-in to succeed");

    await harness.database.execute(
      sql`UPDATE sessions SET expires_at = now() + interval '1 minute'`,
    );

    await service.validateSessionToken(signIn.token);

    const [row] = await harness.database.select().from(sessions).limit(1);

    expect(row?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 60_000);
  });
});
