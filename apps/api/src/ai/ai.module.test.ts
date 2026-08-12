import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createTestApp } from "../testing/app";

let app: INestApplication;

afterEach(async () => {
  await app?.close();
});

describe("AI module isolation", () => {
  it("exposes no HTTP routes under /api/ai", async () => {
    app = await createTestApp();

    // No controller is registered — every AI route should 404
    await request(app.getHttpServer()).get("/api/ai").expect(404);
  });

  it("exposes no HTTP routes under /api/prompts", async () => {
    app = await createTestApp();

    await request(app.getHttpServer()).get("/api/prompts").expect(404);
  });

  it("startup logs contain no API key", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer()).get("/health").expect(200);

    // The health response should not contain any key material
    const body = JSON.stringify(response.body);
    expect(body).not.toMatch(/AIza/); // Gemini key prefix
    expect(body).not.toMatch(/GEMINI_API_KEY/);
    expect(body).not.toMatch(/CLOUDFLARE_API_TOKEN/);
  });

  it("AIService is injectable through Nest DI", async () => {
    app = await createTestApp();

    const aiService = app.get("AI_SERVICE");
    expect(aiService).toBeDefined();
    expect(typeof aiService.run).toBe("function");
  });
});
