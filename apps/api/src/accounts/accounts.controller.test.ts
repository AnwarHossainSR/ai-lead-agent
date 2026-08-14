import "reflect-metadata";

import type { INestApplication } from "@nestjs/common";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { createTestApp } from "../testing/app";
import { authedRequest } from "../testing/authed-request";
import { createAuthenticatedContext } from "../testing/authenticated-context";

/**
 * API tests for task 6.2: operator-only account creation, role change and
 * disablement — including that disabling an account revokes its sessions
 * (design D2/D4, the same "one requirement, not two" behaviour the write
 * helper documents).
 */

let harness: TestDatabase;
let app: INestApplication | undefined;
let operatorCookie: string;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  app = await createTestApp({ DATABASE_URL: harness.url });
  operatorCookie = (await createAuthenticatedContext(harness.database, "operator")).cookie;
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

afterAll(async () => {
  await harness?.close();
});

describe("POST /api/accounts", () => {
  it("creates an account and never returns a password hash", async () => {
    const response = await authedRequest(app?.getHttpServer(), operatorCookie)
      .post("/api/accounts")
      .send({ email: "someone@example.com", password: "a-very-long-password", role: "viewer" })
      .expect(201);

    expect(response.body).toMatchObject({ email: "someone@example.com", role: "viewer" });
    expect(response.body.passwordHash).toBeUndefined();
  });

  it("refuses a password shorter than the configured minimum", async () => {
    await authedRequest(app?.getHttpServer(), operatorCookie)
      .post("/api/accounts")
      .send({ email: "someone@example.com", password: "short", role: "viewer" })
      .expect(400);
  });

  it("refuses a duplicate email", async () => {
    await authedRequest(app?.getHttpServer(), operatorCookie)
      .post("/api/accounts")
      .send({ email: "dup@example.com", password: "a-very-long-password", role: "viewer" })
      .expect(201);

    await authedRequest(app?.getHttpServer(), operatorCookie)
      .post("/api/accounts")
      .send({ email: "dup@example.com", password: "another-long-password", role: "viewer" })
      .expect(400);
  });
});

describe("PATCH /api/accounts/:id/role", () => {
  it("changes the role of an existing account", async () => {
    const target = await createAuthenticatedContext(harness.database, "viewer");

    const response = await authedRequest(app?.getHttpServer(), operatorCookie)
      .patch(`/api/accounts/${target.accountId}/role`)
      .send({ role: "operator" })
      .expect(200);

    expect(response.body).toMatchObject({ id: target.accountId, role: "operator" });
  });

  it("404s for an account that does not exist", async () => {
    await authedRequest(app?.getHttpServer(), operatorCookie)
      .patch("/api/accounts/00000000-0000-0000-0000-000000000000/role")
      .send({ role: "operator" })
      .expect(404);
  });
});

describe("POST /api/accounts/:id/disable", () => {
  it("disables an account and revokes its existing session", async () => {
    const target = await createAuthenticatedContext(harness.database, "viewer");

    // The disabled account's own session still works right up until disable.
    await authedRequest(app?.getHttpServer(), target.cookie).get("/api/outreach").expect(200);

    await authedRequest(app?.getHttpServer(), operatorCookie)
      .post(`/api/accounts/${target.accountId}/disable`)
      .expect(201);

    await authedRequest(app?.getHttpServer(), target.cookie).get("/api/outreach").expect(401);
  });

  it("404s for an account that does not exist", async () => {
    await authedRequest(app?.getHttpServer(), operatorCookie)
      .post("/api/accounts/00000000-0000-0000-0000-000000000000/disable")
      .expect(404);
  });
});
