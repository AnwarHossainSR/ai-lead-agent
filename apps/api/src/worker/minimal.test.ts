import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import Redis from "ioredis";
import { Worker, Queue } from "bullmq";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const TEST_PREFIX = "test-bullmq";

const createBullRedis = () =>
  new Redis(REDIS_URL, { maxRetriesPerRequest: null });

let redis: Redis;

beforeAll(async () => {
  redis = createBullRedis();
  await redis.ping();
});

afterEach(async () => {
  const keys = await redis.keys(`${TEST_PREFIX}:*`);
  if (keys.length > 0) {
    await redis.del(keys);
  }
});

afterAll(async () => {
  await redis.disconnect();
});

describe("minimal worker test with prefix", () => {
  it("processes a simple job", async () => {
    const queue = new Queue("test-queue", { connection: redis, prefix: TEST_PREFIX });
    const worker = new Worker(
      "test-queue",
      async () => ({ done: true }),
      { connection: redis, prefix: TEST_PREFIX },
    );

    await worker.waitUntilReady();

    const job = await queue.add("test-job", { foo: "bar" });

    await new Promise<void>((resolve) => {
      worker.on("completed", () => resolve());
    });

    const state = await job.getState();
    expect(state).toBe("completed");

    await worker.close();
    await queue.close();
  });
});
