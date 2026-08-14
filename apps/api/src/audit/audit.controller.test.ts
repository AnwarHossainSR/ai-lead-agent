import "reflect-metadata";

import { insertAuditEntry } from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import type { INestApplication } from "@nestjs/common";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestApp } from "../testing/app";
import { authedRequest } from "../testing/authed-request";
import { createAuthenticatedContext } from "../testing/authenticated-context";

/**
 * API tests for task 7.3: the operator-only audit log listing endpoint and
 * its filters. Role gating itself is covered by the shared table in
 * `auth/requires-role.test.ts`.
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

describe("GET /api/audit-log", () => {
  it("lists entries newest first", async () => {
    const first = await insertAuditEntry(harness.database, {
      event: "sign_in",
      outcome: "succeeded",
    });
    const second = await insertAuditEntry(harness.database, {
      event: "sign_in",
      outcome: "succeeded",
    });

    const response = await authedRequest(app?.getHttpServer(), operatorCookie)
      .get("/api/audit-log")
      .expect(200);

    expect(response.body.map((row: { id: string }) => row.id)).toEqual([second.id, first.id]);
  });

  it("filters by event", async () => {
    await insertAuditEntry(harness.database, { event: "sign_in", outcome: "succeeded" });
    await insertAuditEntry(harness.database, { event: "sign_out", outcome: "succeeded" });

    const response = await authedRequest(app?.getHttpServer(), operatorCookie)
      .get("/api/audit-log?event=sign_out")
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].event).toBe("sign_out");
  });

  it("respects a limit", async () => {
    await insertAuditEntry(harness.database, { event: "sign_in", outcome: "succeeded" });
    await insertAuditEntry(harness.database, { event: "sign_in", outcome: "succeeded" });

    const response = await authedRequest(app?.getHttpServer(), operatorCookie)
      .get("/api/audit-log?limit=1")
      .expect(200);

    expect(response.body).toHaveLength(1);
  });
});
