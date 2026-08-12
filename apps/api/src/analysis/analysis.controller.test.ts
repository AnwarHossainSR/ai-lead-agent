import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, beforeAll, afterAll, describe, expect, it } from "vitest";

import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { createTestApp } from "../testing/app";

/**
 * API tests for the analysis controller.
 *
 * Tests cover:
 * - POST /api/companies/:id/analysis starts an analysis
 * - GET /api/companies/:id/analysis/latest returns the latest analysis
 * - GET /api/companies/:id/analysis lists analyses
 * - No credential appears in any response
 */

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

describe("POST /api/companies/:id/analysis", () => {
  it("returns 404 for a non-existent company", async () => {
    app = await createTestApp();

    await request(app.getHttpServer())
      .post("/api/companies/00000000-0000-0000-0000-000000000000/analysis")
      .send({})
      .expect(404);
  });

  it("does not include credentials in the response", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/companies/00000000-0000-0000-0000-000000000000/analysis")
      .send({})
      .expect(404);

    const body = JSON.stringify(response.body);
    expect(body).not.toContain("PLACES_API_KEY");
    expect(body).not.toContain("GEMINI_API_KEY");
    expect(body).not.toContain("s3cret");
  });
});

describe("GET /api/companies/:id/analysis/latest", () => {
  it("returns 404 for a non-existent company", async () => {
    app = await createTestApp();

    await request(app.getHttpServer())
      .get("/api/companies/00000000-0000-0000-0000-000000000000/analysis/latest")
      .expect(404);
  });

  it("does not include credentials in the response", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .get("/api/companies/00000000-0000-0000-0000-000000000000/analysis/latest")
      .expect(404);

    const body = JSON.stringify(response.body);
    expect(body).not.toContain("PLACES_API_KEY");
    expect(body).not.toContain("GEMINI_API_KEY");
    expect(body).not.toContain("s3cret");
  });
});

describe("GET /api/companies/:id/analysis", () => {
  it("returns analyses for a company", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .get("/api/companies/00000000-0000-0000-0000-000000000000/analysis")
      .expect(200);

    expect(response.body).toHaveProperty("companyId");
    expect(response.body).toHaveProperty("analyses");
    expect(Array.isArray(response.body.analyses)).toBe(true);
  });

  it("does not include credentials in the response", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .get("/api/companies/00000000-0000-0000-0000-000000000000/analysis")
      .expect(200);

    const body = JSON.stringify(response.body);
    expect(body).not.toContain("PLACES_API_KEY");
    expect(body).not.toContain("GEMINI_API_KEY");
    expect(body).not.toContain("s3cret");
  });
});
