import { type Database } from "@mela/database";
import { HealthIndicatorService } from "@nestjs/terminus";
import type Redis from "ioredis";
import { describe, expect, it } from "vitest";

import { PostgresHealthIndicator } from "./postgres.health";
import { RedisHealthIndicator } from "./redis.health";

/**
 * The timeout path, exercised directly.
 *
 * A dependency that accepts the connection and then never answers is the one
 * case the endpoint cannot reach through configuration — a closed port refuses
 * immediately, which is a different failure. A stub that never settles is what
 * a hung server looks like from in here.
 */

function neverSettles<T>(): Promise<T> {
  return new Promise<T>(() => {
    // Intentionally never resolved.
  });
}

const health = new HealthIndicatorService();

describe("PostgresHealthIndicator", () => {
  it("reports down with a timeout message when the query never returns", async () => {
    const hung = { execute: neverSettles } as unknown as Database;
    const indicator = new PostgresHealthIndicator(health, hung);

    const started = Date.now();
    const result = await indicator.isHealthy("postgres");
    const elapsed = Date.now() - started;

    expect(result).toEqual({
      postgres: { status: "down", message: "PostgreSQL did not respond within 2000 ms." },
    });
    expect(elapsed).toBeGreaterThanOrEqual(2_000);
    expect(elapsed).toBeLessThan(4_000);
  });

  it("reports up when the query returns", async () => {
    const answering = { execute: async () => [] } as unknown as Database;
    const indicator = new PostgresHealthIndicator(health, answering);

    expect(await indicator.isHealthy("postgres")).toEqual({
      postgres: { status: "up", message: "PostgreSQL is reachable." },
    });
  });
});

describe("RedisHealthIndicator", () => {
  it("reports down with a timeout message when PING never returns", async () => {
    const hung = { ping: neverSettles } as unknown as Redis;
    const indicator = new RedisHealthIndicator(health, hung);

    const started = Date.now();
    const result = await indicator.isHealthy("redis");
    const elapsed = Date.now() - started;

    expect(result).toEqual({
      redis: { status: "down", message: "Redis did not respond within 2000 ms." },
    });
    expect(elapsed).toBeGreaterThanOrEqual(2_000);
    expect(elapsed).toBeLessThan(4_000);
  });

  it("reports up when PING returns", async () => {
    const answering = { ping: async () => "PONG" } as unknown as Redis;
    const indicator = new RedisHealthIndicator(health, answering);

    expect(await indicator.isHealthy("redis")).toEqual({
      redis: { status: "up", message: "Redis is reachable." },
    });
  });

  it("reports down without repeating the driver's message", async () => {
    const leaking = {
      ping: async () => {
        throw new Error("connect ECONNREFUSED redis://:hunter2@127.0.0.1:6379");
      },
    } as unknown as Redis;
    const indicator = new RedisHealthIndicator(health, leaking);

    const result = await indicator.isHealthy("redis");

    expect(result).toEqual({ redis: { status: "down", message: "Redis is unreachable." } });
  });
});
