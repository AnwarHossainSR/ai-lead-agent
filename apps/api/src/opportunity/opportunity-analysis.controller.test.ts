import { type INestApplication } from "@nestjs/common";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { insertCompany } from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { createTestApp } from "../testing/app";
import { authedRequest } from "../testing/authed-request";
import { createAuthenticatedContext } from "../testing/authenticated-context";

describe("POST /api/opportunity/analysis/:companyId", () => {
  let harness: TestDatabase;
  let app: INestApplication | undefined;
  let authCookie: string;

  /** Every route requires a session now (task 4.1); this attaches one to every call below without touching each call site. */
  function request(server: Parameters<typeof authedRequest>[0]) {
    return authedRequest(server, authCookie);
  }

  beforeAll(async () => {
    harness = await setupTestDatabase();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("returns 404 for a non-existent company", async () => {
    app = await createTestApp({ DATABASE_URL: harness.url });
    authCookie = (await createAuthenticatedContext(harness.database)).cookie;

    const response = await request(app.getHttpServer())
      .post("/api/opportunity/analysis/00000000-0000-0000-0000-000000000000")
      .expect(404);

    expect(response.body.message).toBeDefined();
  });

  it("returns below_threshold when no analysis exists", async () => {
    app = await createTestApp({ DATABASE_URL: harness.url });
    authCookie = (await createAuthenticatedContext(harness.database)).cookie;

    const company = await insertCompany(harness.database, {
      name: "Test Company",
      countryId: "uae",
      cityId: "dubai",
      industryId: "logistics",
      discoverySource: "test",
      discoverySourceUrl: "https://example.com",
    });

    const response = await request(app.getHttpServer())
      .post(`/api/opportunity/analysis/${company.id}`)
      .expect(200);

    expect(response.body.run).toBeDefined();
    expect(response.body.run.outcome).toBe("below_threshold");
    expect(response.body.opportunities).toEqual([]);
  });
});
