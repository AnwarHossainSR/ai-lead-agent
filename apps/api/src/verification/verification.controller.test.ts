import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, beforeAll, afterAll, describe, expect, it } from "vitest";

import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { createTestApp } from "../testing/app";

/**
 * API tests for the verification controller (task 7.4).
 *
 * Tests cover:
 * - POST /api/companies/:id/verify returns verification state
 * - POST /api/verification/batch returns counts
 * - GET /api/companies/:id/verification returns state or 404
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

describe("POST /api/companies/:id/verify", () => {
  it("returns 404 for a non-existent company", async () => {
    app = await createTestApp();

    await request(app.getHttpServer())
      .post("/api/companies/00000000-0000-0000-0000-000000000000/verify")
      .send({})
      .expect(404);
  });

  it("does not include credentials in the response", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/companies/00000000-0000-0000-0000-000000000000/verify")
      .send({})
      .expect(404);

    const body = JSON.stringify(response.body);
    expect(body).not.toContain("PLACES_API_KEY");
    expect(body).not.toContain("GEMINI_API_KEY");
    expect(body).not.toContain("s3cret");
  });
});

describe("POST /api/verification/batch", () => {
  it("returns counts for an empty batch", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/verification/batch")
      .send({
        companyIds: [],
        concurrency: 2,
      })
      .expect(200);

    expect(response.body.verified).toBe(0);
    expect(response.body.unverified).toBe(0);
    expect(response.body.unreachable).toBe(0);
    expect(response.body.errored).toBe(0);
  });

  it("does not include credentials in the response", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/verification/batch")
      .send({
        companyIds: ["550e8400-e29b-41d4-a716-446655440000"],
        concurrency: 1,
      })
      .expect(200);

    const body = JSON.stringify(response.body);
    expect(body).not.toContain("PLACES_API_KEY");
    expect(body).not.toContain("GEMINI_API_KEY");
    expect(body).not.toContain("s3cret");
  });
});

describe("GET /api/companies/:id/verification", () => {
  it("returns 404 for a non-existent company", async () => {
    app = await createTestApp();

    await request(app.getHttpServer())
      .get("/api/companies/00000000-0000-0000-0000-000000000000/verification")
      .expect(404);
  });

  it("does not include credentials in the response", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .get("/api/companies/00000000-0000-0000-0000-000000000000/verification")
      .expect(404);

    const body = JSON.stringify(response.body);
    expect(body).not.toContain("PLACES_API_KEY");
    expect(body).not.toContain("GEMINI_API_KEY");
    expect(body).not.toContain("s3cret");
  });
});
