import { type INestApplication } from "@nestjs/common";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { createTestApp } from "../testing/app";
import { authedRequest } from "../testing/authed-request";
import { createAuthenticatedContext } from "../testing/authenticated-context";

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
let authCookie: string;

/** Every route requires a session now (task 4.1); this attaches one to every call below without touching each call site. */
function request(server: Parameters<typeof authedRequest>[0]) {
  return authedRequest(server, authCookie);
}

/** Every test here boots its own app rather than sharing one via `beforeEach` — this pairs an authenticated context with it, against the same database the app is configured to query. */
async function startAuthenticatedApp(
  overrides: Parameters<typeof createTestApp>[0] = {},
): Promise<INestApplication> {
  const nextApp = await createTestApp({ DATABASE_URL: harness.url, ...overrides });
  authCookie = (await createAuthenticatedContext(harness.database)).cookie;
  return nextApp;
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

describe("POST /api/companies/:id/analysis", () => {
  it("returns 404 for a non-existent company", async () => {
    app = await startAuthenticatedApp();

    await request(app.getHttpServer())
      .post("/api/companies/00000000-0000-0000-0000-000000000000/analysis")
      .send({})
      .expect(404);
  });

  it("does not include credentials in the response", async () => {
    app = await startAuthenticatedApp();

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
    app = await startAuthenticatedApp();

    await request(app.getHttpServer())
      .get("/api/companies/00000000-0000-0000-0000-000000000000/analysis/latest")
      .expect(404);
  });

  it("does not include credentials in the response", async () => {
    app = await startAuthenticatedApp();

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
    app = await startAuthenticatedApp();

    const response = await request(app.getHttpServer())
      .get("/api/companies/00000000-0000-0000-0000-000000000000/analysis")
      .expect(200);

    expect(response.body).toHaveProperty("companyId");
    expect(response.body).toHaveProperty("analyses");
    expect(Array.isArray(response.body.analyses)).toBe(true);
  });

  it("does not include credentials in the response", async () => {
    app = await startAuthenticatedApp();

    const response = await request(app.getHttpServer())
      .get("/api/companies/00000000-0000-0000-0000-000000000000/analysis")
      .expect(200);

    const body = JSON.stringify(response.body);
    expect(body).not.toContain("PLACES_API_KEY");
    expect(body).not.toContain("GEMINI_API_KEY");
    expect(body).not.toContain("s3cret");
  });
});

describe("GET /api/companies/:id/technologies", () => {
  it("returns technologies for a company", async () => {
    app = await startAuthenticatedApp();

    const response = await request(app.getHttpServer()).get(
      "/api/companies/00000000-0000-0000-0000-000000000000/technologies",
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("companyId");
    expect(response.body).toHaveProperty("technologies");
    expect(Array.isArray(response.body.technologies)).toBe(true);
  });

  it("does not include credentials in the response", async () => {
    app = await startAuthenticatedApp();

    const response = await request(app.getHttpServer())
      .get("/api/companies/00000000-0000-0000-0000-000000000000/technologies")
      .expect(200);

    const body = JSON.stringify(response.body);
    expect(body).not.toContain("PLACES_API_KEY");
    expect(body).not.toContain("GEMINI_API_KEY");
    expect(body).not.toContain("s3cret");
  });
});

describe("POST /api/analysis/:id/detect", () => {
  it("returns 404 for a non-existent analysis", async () => {
    app = await startAuthenticatedApp();

    await request(app.getHttpServer())
      .post("/api/analysis/00000000-0000-0000-0000-000000000000/detect")
      .expect(404);
  });
});

describe("technology detection module integrity", () => {
  it("does not issue network requests or call a language model", async () => {
    app = await startAuthenticatedApp();

    // Track network requests
    const networkRequests: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request) => {
      networkRequests.push(String(url));
      return new Response("{}", { status: 200 });
    };

    try {
      // Call the technologies endpoint
      await request(app.getHttpServer())
        .get("/api/companies/00000000-0000-0000-0000-000000000000/technologies")
        .expect(200);

      // No network requests should have been made
      expect(networkRequests).toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
