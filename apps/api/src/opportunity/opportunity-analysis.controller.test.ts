import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, beforeAll, afterAll, describe, expect, it } from "vitest";

import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { createTestApp } from "../testing/app";
import { insertCompany } from "@mela/database";

describe("POST /api/opportunity/analysis/:companyId", () => {
  let harness: TestDatabase;
  let app: INestApplication | undefined;

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

    const response = await request(app.getHttpServer())
      .post("/api/opportunity/analysis/00000000-0000-0000-0000-000000000000")
      .expect(404);

    expect(response.body.message).toBeDefined();
  });

  it("returns below_threshold when no analysis exists", async () => {
    app = await createTestApp({ DATABASE_URL: harness.url });

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
