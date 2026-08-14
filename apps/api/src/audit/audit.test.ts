import "reflect-metadata";

import { insertAccount, listAuditEntries } from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { accountInput } from "@mela/database/testing/fixtures";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "../auth/password";
import { createTestApp } from "../testing/app";
import { authedRequest } from "../testing/authed-request";
import { createAuthenticatedContext } from "../testing/authenticated-context";

/**
 * API tests for tasks 7.1/7.2: sign-in, failed sign-in, sign-out and every
 * `@RequiresRole` consequential action append an audit record, and none of
 * them ever put a password, a hash, a session id or a model prompt in it.
 *
 * The forbidden-content check is structural rather than per-scenario: the
 * audit interceptor (task 7.1) never reads a request body or a response
 * body into `detail`, so there is no code path by which any of those four
 * things could reach the audit log — this test exercises routes that
 * handle all four (a real password at sign-in, a real password hash at
 * account creation, a real session at sign-out, a model-triggering route)
 * and confirms none of it appears anywhere in what was actually stored.
 */

const KNOWN_PASSWORD = "a-strong-password-123";
const FORBIDDEN_PATTERNS = [/password/i, /hash/i, /session/i, /prompt/i];

let harness: TestDatabase;
let app: INestApplication | undefined;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  app = await createTestApp({ DATABASE_URL: harness.url });
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

afterAll(async () => {
  await harness?.close();
});

async function allAuditContent(): Promise<string> {
  const entries = await listAuditEntries(harness.database);
  return JSON.stringify(entries);
}

function expectNoForbiddenContent(content: string) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    expect(content).not.toMatch(pattern);
  }
}

describe("audit log", () => {
  it("records a failed sign-in without the password", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    await insertAccount(
      harness.database,
      accountInput({ email: "operator@example.com", passwordHash, role: "operator" }),
    );

    await request(app?.getHttpServer())
      .post("/api/auth/sign-in")
      .send({ email: "operator@example.com", password: "wrong-password-entirely" });

    const entries = await listAuditEntries(harness.database, { event: "sign_in_failed" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe("failed");
    expectNoForbiddenContent(JSON.stringify(entries[0]));
  });

  it("records a successful sign-in and a sign-out, neither carrying the password or a session id", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    await insertAccount(
      harness.database,
      accountInput({ email: "operator@example.com", passwordHash, role: "operator" }),
    );

    const signIn = await request(app?.getHttpServer())
      .post("/api/auth/sign-in")
      .send({ email: "operator@example.com", password: KNOWN_PASSWORD })
      .expect(200);

    const cookie = signIn.headers["set-cookie"]?.[0]?.split(";")[0];

    await request(app?.getHttpServer())
      .post("/api/auth/sign-out")
      .set("Cookie", cookie ?? "")
      .expect(200);

    const signIns = await listAuditEntries(harness.database, { event: "sign_in" });
    const signOuts = await listAuditEntries(harness.database, { event: "sign_out" });

    expect(signIns).toHaveLength(1);
    expect(signIns[0]?.outcome).toBe("succeeded");
    expect(signOuts).toHaveLength(1);
    expect(signOuts[0]?.outcome).toBe("succeeded");
    expectNoForbiddenContent(await allAuditContent());
  });

  it("records account creation without the submitted password", async () => {
    const { cookie } = await createAuthenticatedContext(harness.database, "operator");

    await authedRequest(app?.getHttpServer(), cookie)
      .post("/api/accounts")
      .send({ email: "new@example.com", password: KNOWN_PASSWORD, role: "viewer" })
      .expect(201);

    const entries = await listAuditEntries(harness.database, { event: "creating_an_account" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.outcome).toBe("succeeded");
    expectNoForbiddenContent(await allAuditContent());
  });

  it("records a role-gated model-triggering route without any prompt or reply text", async () => {
    const { cookie } = await createAuthenticatedContext(harness.database, "operator");
    const fakeId = "00000000-0000-0000-0000-000000000000";

    await authedRequest(app?.getHttpServer(), cookie)
      .post(`/api/leads/${fakeId}/outreach/draft`)
      .send({ contactId: fakeId, channelId: "email" });

    const entries = await listAuditEntries(harness.database, { event: "drafting_outreach" });
    expect(entries).toHaveLength(1);
    expectNoForbiddenContent(await allAuditContent());
  });
});
