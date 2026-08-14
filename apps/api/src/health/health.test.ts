import { type INestApplication } from "@nestjs/common";
import { HealthCheckService } from "@nestjs/terminus";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CLOSED_PORT_URL, createTestApp } from "../testing/app";
import { HealthController } from "./health.controller";
import { PostgresHealthIndicator } from "./postgres.health";
import { RedisHealthIndicator } from "./redis.health";
import { SHUTDOWN_STATE, ShutdownState } from "./shutdown-state";

/**
 * These talk to the PostgreSQL and Redis containers from `docker compose`. The
 * "dependency is down" cases point the API at a closed port instead of
 * stopping a container, which produces the same connection refusal without
 * taking the service away from everything else running against it.
 */

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /health", () => {
  it("reports every dependency as reachable when they are", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer()).get("/health").expect(200);

    expect(response.body).toEqual({
      status: "ok",
      info: {
        postgres: { status: "up", message: "PostgreSQL is reachable." },
        redis: { status: "up", message: "Redis is reachable." },
      },
      error: {},
      details: {
        postgres: { status: "up", message: "PostgreSQL is reachable." },
        redis: { status: "up", message: "Redis is reachable." },
      },
    });
  });

  it("is served at the root, outside the /api prefix", async () => {
    app = await createTestApp();

    await request(app.getHttpServer()).get("/api/health").expect(404);
  });

  it("fails with 503 when PostgreSQL is unreachable, and says which one", async () => {
    app = await createTestApp({ DATABASE_URL: CLOSED_PORT_URL.postgres });

    const response = await request(app.getHttpServer()).get("/health").expect(503);

    expect(response.body.status).toBe("error");
    expect(response.body.details.postgres.status).toBe("down");
    expect(response.body.details.postgres.message).toMatch(/^PostgreSQL is unreachable/);

    // The scenario is specific about this half: a report that everything is
    // broken is no more useful than one that says nothing is.
    expect(response.body.details.redis).toEqual({
      status: "up",
      message: "Redis is reachable.",
    });
    expect(response.body.error).toEqual({
      postgres: response.body.details.postgres,
    });
  });

  it("fails with 503 when Redis is unreachable, and says which one", async () => {
    app = await createTestApp({ REDIS_URL: CLOSED_PORT_URL.redis });

    const response = await request(app.getHttpServer()).get("/health").expect(503);

    expect(response.body.status).toBe("error");
    expect(response.body.details.redis.status).toBe("down");
    expect(response.body.details.redis.message).toMatch(/^Redis is unreachable/);
    expect(response.body.details.postgres).toEqual({
      status: "up",
      message: "PostgreSQL is reachable.",
    });
  });

  it("puts no credential in the failure body", async () => {
    app = await createTestApp({
      DATABASE_URL: CLOSED_PORT_URL.postgres,
      REDIS_URL: CLOSED_PORT_URL.redis,
    });

    const response = await request(app.getHttpServer()).get("/health").expect(503);
    const body = JSON.stringify(response.body);

    expect(body).not.toContain(CLOSED_PORT_URL.password);
    expect(body).not.toContain(CLOSED_PORT_URL.postgres);
    expect(body).not.toContain(CLOSED_PORT_URL.redis);
    expect(body).not.toContain("postgresql://");
    expect(body).not.toContain("redis://");
  });

  it("answers within a bounded time even with both dependencies unreachable", async () => {
    app = await createTestApp({
      DATABASE_URL: CLOSED_PORT_URL.postgres,
      REDIS_URL: CLOSED_PORT_URL.redis,
    });

    const started = Date.now();
    await request(app.getHttpServer()).get("/health").expect(503);
    const elapsed = Date.now() - started;

    // The two checks run concurrently and each is bounded at 2 seconds, so a
    // generous ceiling still proves the endpoint cannot be made to hang.
    expect(elapsed).toBeLessThan(6_000);
  });

  it("needs no authentication", async () => {
    app = await createTestApp();

    await request(app.getHttpServer()).get("/health").expect(200);
  });
});

describe("GET /live", () => {
  it("responds with 200 and status ok", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer()).get("/live").expect(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("succeeds even when the database is unreachable", async () => {
    app = await createTestApp({ DATABASE_URL: CLOSED_PORT_URL.postgres });

    await request(app.getHttpServer()).get("/live").expect(200);
  });

  it("is served at the root, outside the /api prefix", async () => {
    app = await createTestApp();

    await request(app.getHttpServer()).get("/api/live").expect(404);
  });

  it("needs no authentication", async () => {
    app = await createTestApp();

    await request(app.getHttpServer()).get("/live").expect(200);
  });
});

describe("GET /ready", () => {
  it("responds with 200 when dependencies are reachable", async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer()).get("/ready").expect(200);
    expect(response.body.status).toBe("ok");
  });

  it("fails with 503 when the database is unreachable", async () => {
    app = await createTestApp({ DATABASE_URL: CLOSED_PORT_URL.postgres });

    const response = await request(app.getHttpServer()).get("/ready").expect(503);
    expect(response.body.status).toBe("error");
  });

  it("fails with 503 during shutdown while liveness succeeds", async () => {
    const shutdownState = new ShutdownState();
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: SHUTDOWN_STATE, useValue: shutdownState },
        {
          provide: HealthCheckService,
          useValue: {
            check: vi
              .fn()
              .mockResolvedValue({ status: "ok" as const, info: {}, error: {}, details: {} }),
          },
        },
        { provide: PostgresHealthIndicator, useValue: { isHealthy: vi.fn() } },
        { provide: RedisHealthIndicator, useValue: { isHealthy: vi.fn() } },
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    shutdownState.markShuttingDown();
    expect(shutdownState.isShuttingDown()).toBe(true);

    const response = await request(app.getHttpServer()).get("/ready");
    expect(response.status).toBe(503);
    expect(response.body.status).toBe("error");
    expect(response.body.details.shutdown.status).toBe("down");

    await request(app.getHttpServer()).get("/live").expect(200);

    await app.close();
  });

  it("is served at the root, outside the /api prefix", async () => {
    app = await createTestApp();

    await request(app.getHttpServer()).get("/api/ready").expect(404);
  });

  it("needs no authentication", async () => {
    app = await createTestApp();

    await request(app.getHttpServer()).get("/ready").expect(200);
  });
});
