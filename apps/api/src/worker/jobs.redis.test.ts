import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import Redis from "ioredis";
import { Worker } from "bullmq";
import { QueueService } from "./queue.service";
import { JobService, Skipped } from "./job.service";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const TEST_PREFIX = "test-bullmq";

const createBullRedis = () =>
  new Redis(REDIS_URL, { maxRetriesPerRequest: null });

let redis: Redis;
let queueService: QueueService;
let jobService: JobService;

beforeAll(async () => {
  redis = createBullRedis();
  await redis.ping();

  queueService = new QueueService(redis);
  queueService.setup();
  jobService = new JobService(queueService);
});

afterEach(async () => {
  const keys = await redis.keys("bull:*");
  if (keys.length > 0) {
    await redis.del(keys);
  }
});

afterAll(async () => {
  await redis.disconnect();
});

describe("job idempotency (Redis integration)", () => {
  it("absorbs a duplicate enqueue while the first is pending", async () => {
    const job1 = await jobService.enqueue("scoring", {
      companyId: "company-1",
      weightVersion: 1,
    });
    const job2 = await jobService.enqueue("scoring", {
      companyId: "company-1",
      weightVersion: 1,
    });

    expect(job1.id).toBe(job2.id);
  });

  it("permits re-enqueue after the earlier job completed", async () => {
    const worker = new Worker(
      "scoring",
      async () => ({ completed: true }),
      { connection: createBullRedis() },
    );

    const job1 = await jobService.enqueue("scoring", {
      companyId: "company-1",
      weightVersion: 1,
    });

    await new Promise<void>((resolve) => {
      worker.on("completed", () => resolve());
    });

    await job1.remove();

    const job2 = await jobService.enqueue("scoring", {
      companyId: "company-1",
      weightVersion: 1,
    });

    expect(job2).toBeDefined();
    expect(job2.id).toBe("scoring-company-1");

    await worker.close();
  });

  it("creates distinct jobs for different subjects", async () => {
    const job1 = await jobService.enqueue("scoring", {
      companyId: "company-1",
      weightVersion: 1,
    });
    const job2 = await jobService.enqueue("scoring", {
      companyId: "company-2",
      weightVersion: 1,
    });

    expect(job1.id).not.toBe(job2.id);
  });
});

describe("currency skip (Redis integration)", () => {
  it("completes a job as skipped when the processor returns Skipped", async () => {
    const worker = new Worker(
      "scoring",
      async () => ({ _tag: "skipped", reason: "already current" }),
      { connection: redis, prefix: TEST_PREFIX },
    );

    await worker.waitUntilReady();

    let completedJob: any;
    await new Promise<void>((resolve) => {
      worker.on("completed", (job) => {
        completedJob = job;
        resolve();
      });
    });

    const job = await jobService.enqueue("scoring", {
      companyId: "company-1",
      weightVersion: 1,
    });

    await worker.close();

    const state = await job.getState();
    expect(state).toBe("completed");
    expect(completedJob.returnvalue).toEqual({ _tag: "skipped", reason: "already current" });
  });
});
