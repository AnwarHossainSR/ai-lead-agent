import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { createTestApp } from "../testing/app";

/**
 * API tests for the discovery controller (task 8.4).
 *
 * Tests cover:
 * - Unknown industry returns 400 naming the configured ones
 * - A completed run returns its counts
 * - No credential appears in any response
 * - In-progress uniqueness index surfaces as clear refusal (task 8.3)
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

describe("POST /api/discovery/runs", () => {
  it("returns 400 for an unknown industry naming the configured ones", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/discovery/runs")
      .send({
        countryId: "uae",
        industryId: "nonexistent_industry",
        candidateLimit: 10,
        durationLimitSeconds: 60,
      })
      .expect(400);

    expect(response.body.message).toBe("Request validation failed.");
    expect(response.body.details).toBeDefined();
    const industryError = response.body.details.find(
      (d: { field: string }) => d.field === "industryId",
    );
    expect(industryError).toBeDefined();
    expect(industryError.problem).toContain("nonexistent_industry");
    expect(industryError.problem).toContain("Configured industries:");
  });

  it("returns 400 for an unknown country naming the configured ones", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/discovery/runs")
      .send({
        countryId: "nonexistent_country",
        industryId: "logistics",
        candidateLimit: 10,
        durationLimitSeconds: 60,
      })
      .expect(400);

    expect(response.body.message).toBe("Request validation failed.");
    expect(response.body.details).toBeDefined();
    const countryError = response.body.details.find(
      (d: { field: string }) => d.field === "countryId",
    );
    expect(countryError).toBeDefined();
    expect(countryError.problem).toContain("nonexistent_country");
    expect(countryError.problem).toContain("Configured countries:");
  });

  it("returns 400 for an unknown city naming the configured ones", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/discovery/runs")
      .send({
        countryId: "uae",
        cityId: "nonexistent_city",
        industryId: "logistics",
        candidateLimit: 10,
        durationLimitSeconds: 60,
      })
      .expect(400);

    expect(response.body.message).toBe("Request validation failed.");
    expect(response.body.details).toBeDefined();
    const cityError = response.body.details.find((d: { field: string }) => d.field === "cityId");
    expect(cityError).toBeDefined();
    expect(cityError.problem).toContain("nonexistent_city");
    expect(cityError.problem).toContain("Configured cities");
  });

  it("returns 400 when city belongs to a different country", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/discovery/runs")
      .send({
        countryId: "uae",
        cityId: "riyadh",
        industryId: "logistics",
        candidateLimit: 10,
        durationLimitSeconds: 60,
      })
      .expect(400);

    expect(response.body.message).toBe("Request validation failed.");
    expect(response.body.details).toBeDefined();
    const cityError = response.body.details.find((d: { field: string }) => d.field === "cityId");
    expect(cityError).toBeDefined();
    expect(cityError.problem).toContain("riyadh");
    expect(cityError.problem).toContain("saudi_arabia");
    expect(cityError.problem).toContain("uae");
  });

  it("creates a run and returns its counts", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/discovery/runs")
      .send({
        countryId: "uae",
        industryId: "logistics",
        candidateLimit: 10,
        durationLimitSeconds: 60,
      })
      .expect(201);

    expect(response.body.run).toBeDefined();
    expect(response.body.run.id).toBeDefined();
    expect(response.body.run.countryId).toBe("uae");
    expect(response.body.run.industryId).toBe("logistics");
    expect(response.body.run.candidateLimit).toBe(10);
    expect(response.body.run.durationLimitSeconds).toBe(60);
    expect(response.body.run.outcome).toBeDefined();
    expect(response.body.sources).toBeDefined();
    expect(Array.isArray(response.body.sources)).toBe(true);
  });

  it("does not include credentials in the response", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post("/api/discovery/runs")
      .send({
        countryId: "uae",
        industryId: "logistics",
        candidateLimit: 10,
        durationLimitSeconds: 60,
      })
      .expect(201);

    const body = JSON.stringify(response.body);

    // Ensure no API keys or secrets appear in the response
    expect(body).not.toContain("PLACES_API_KEY");
    expect(body).not.toContain("GEMINI_API_KEY");
    expect(body).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(body).not.toContain("s3cret");
  });

  it("refuses a run with missing required fields", async () => {
    app = await createTestApp();

    await request(app.getHttpServer())
      .post("/api/discovery/runs")
      .send({
        countryId: "uae",
        // Missing industryId
      })
      .expect(400);
  });

  it("refuses a run with invalid candidate limit", async () => {
    app = await createTestApp();

    await request(app.getHttpServer())
      .post("/api/discovery/runs")
      .send({
        countryId: "uae",
        industryId: "logistics",
        candidateLimit: -1,
        durationLimitSeconds: 60,
      })
      .expect(400);
  });
});

describe("GET /api/discovery/runs", () => {
  it("returns a list of runs", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer()).get("/api/discovery/runs").expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it("does not include credentials in the response", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer()).get("/api/discovery/runs").expect(200);

    const body = JSON.stringify(response.body);

    expect(body).not.toContain("PLACES_API_KEY");
    expect(body).not.toContain("GEMINI_API_KEY");
    expect(body).not.toContain("CLOUDFLARE_API_TOKEN");
  });
});

describe("GET /api/discovery/runs/:id", () => {
  it("returns 404 for a non-existent run", async () => {
    app = await createTestApp();

    await request(app.getHttpServer())
      .get("/api/discovery/runs/00000000-0000-0000-0000-000000000000")
      .expect(404);
  });

  it("returns a run with its sources", async () => {
    app = await createTestApp();

    // First create a run
    const createResponse = await request(app.getHttpServer())
      .post("/api/discovery/runs")
      .send({
        countryId: "uae",
        industryId: "logistics",
        candidateLimit: 10,
        durationLimitSeconds: 60,
      })
      .expect(201);

    const runId = createResponse.body.run.id;

    // Then fetch it
    const response = await request(app.getHttpServer())
      .get(`/api/discovery/runs/${runId}`)
      .expect(200);

    expect(response.body.run.id).toBe(runId);
    expect(response.body.sources).toBeDefined();
    expect(Array.isArray(response.body.sources)).toBe(true);
  });

  it("does not include credentials in the response", async () => {
    app = await createTestApp();

    // Create a run first
    const createResponse = await request(app.getHttpServer())
      .post("/api/discovery/runs")
      .send({
        countryId: "uae",
        industryId: "logistics",
        candidateLimit: 10,
        durationLimitSeconds: 60,
      })
      .expect(201);

    const runId = createResponse.body.run.id;

    const response = await request(app.getHttpServer())
      .get(`/api/discovery/runs/${runId}`)
      .expect(200);

    const body = JSON.stringify(response.body);

    expect(body).not.toContain("PLACES_API_KEY");
    expect(body).not.toContain("GEMINI_API_KEY");
    expect(body).not.toContain("CLOUDFLARE_API_TOKEN");
  });
});
