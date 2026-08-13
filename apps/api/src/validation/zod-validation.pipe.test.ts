import { Body, Controller, type INestApplication, Post, Query } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { type ApiEnv } from "@mela/config/env";

import { configureApp } from "../create-app";
import { silentLogger } from "../testing/silent-logger";
import { type InferDto, createZodDto } from "./zod-dto";
import { ZodValidationPipe } from "./zod-validation.pipe";

const credentialsSchema = z.object({
  username: z.string().trim().min(1, "Expected a username."),
  password: z.string().min(8, "Expected at least 8 characters."),
});

const CredentialsDto = createZodDto(credentialsSchema);
type CredentialsDto = InferDto<typeof CredentialsDto>;

const pagingSchema = z.object({
  page: z.coerce.number().int().min(1, "Expected a page number of 1 or more."),
});

const PagingDto = createZodDto(pagingSchema);
type PagingDto = InferDto<typeof PagingDto>;

@Controller("subjects")
class SubjectsController {
  @Post()
  create(@Body() body: CredentialsDto, @Query() query: PagingDto): unknown {
    return { body, query };
  }
}

/** Boots only the controller under test, with the application's real pipe. */
async function createPipeApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ controllers: [SubjectsController] })
    .setLogger(silentLogger)
    .compile();

  const app = configureApp(moduleRef.createNestApplication(), {
    NODE_ENV: "test",
    API_PORT: 0,
    DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
    REDIS_URL: "redis://127.0.0.1:1",
    WEB_ORIGIN: "http://localhost:3000",
    GEMINI_API_KEY: "test-gemini-key",
    CLOUDFLARE_ACCOUNT_ID: "test-cf-account",
    CLOUDFLARE_API_TOKEN: "test-cf-token",
    AI_MODEL_DEFAULT: "gemini-2.5-pro",
    AI_MODEL_FAST: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    AI_MAX_OUTPUT_TOKENS: 4096,
    AI_TIMEOUT_MS: 60000,
    AI_SPEND_CEILING_USD: 20,
    AI_SPEND_WINDOW_HOURS: 24,
    PLACES_BASE_URL: "https://maps.googleapis.com",
    ANALYSIS_ARTIFACT_ROOT: "./test-analysis-artifacts",
    ANALYSIS_NAVIGATION_TIMEOUT_MS: 30000,
    ANALYSIS_RUN_TIMEOUT_MS: 120000,
    ANALYSIS_MAX_PAGE_BYTES: 10485760,
    WORKER_SHUTDOWN_TIMEOUT_MS: 30000,
    QSTASH_URL: "https://qstash-eu-central-1.upstash.io",
    QSTASH_TOKEN: "test-qstash-token",
    QSTASH_CURRENT_SIGNING_KEY: "sig_test",
    QSTASH_NEXT_SIGNING_KEY: "sig_test_next",
  } satisfies ApiEnv);

  await app.init();
  return app;
}

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("ZodValidationPipe", () => {
  it("passes a valid request through with the parsed value", async () => {
    app = await createPipeApp();

    const response = await request(app.getHttpServer())
      .post("/api/subjects?page=2")
      .send({ username: "  amal  ", password: "long-enough" })
      .expect(201);

    // Parsed, not merely checked: the trim and the coercion both took effect.
    expect(response.body).toEqual({
      body: { username: "amal", password: "long-enough" },
      query: { page: 2 },
    });
  });

  it("rejects an invalid body with 400 and names the field", async () => {
    app = await createPipeApp();

    const response = await request(app.getHttpServer())
      .post("/api/subjects?page=1")
      .send({ username: "amal", password: "short" })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      message: "Request validation failed.",
      details: [{ field: "password", problem: "Expected at least 8 characters." }],
    });
  });

  it("validates query parameters as well as bodies", async () => {
    app = await createPipeApp();

    const response = await request(app.getHttpServer())
      .post("/api/subjects?page=0")
      .send({ username: "amal", password: "long-enough" })
      .expect(400);

    expect(response.body.details).toEqual([
      { field: "page", problem: "Expected a page number of 1 or more." },
    ]);
  });

  it("never echoes the rejected value back", async () => {
    app = await createPipeApp();

    const response = await request(app.getHttpServer())
      .post("/api/subjects?page=1")
      .send({ username: "amal", password: "hunter2" })
      .expect(400);

    // A rejected body can carry a password, and an echoed error message writes
    // it into every proxy log between here and the client.
    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });

  it("reports every problem, not just the first", async () => {
    app = await createPipeApp();

    const response = await request(app.getHttpServer())
      .post("/api/subjects?page=1")
      .send({ username: "   ", password: "short" })
      .expect(400);

    expect(response.body.details).toHaveLength(2);
    expect(response.body.details.map((detail: { field: string }) => detail.field)).toEqual([
      "username",
      "password",
    ]);
  });

  it("leaves an argument alone when its type carries no schema", () => {
    const pipe = new ZodValidationPipe();

    expect(pipe.transform("raw", { type: "param", metatype: String, data: "id" })).toBe("raw");
    expect(pipe.transform(42, { type: "custom", metatype: undefined, data: undefined })).toBe(42);
  });
});
