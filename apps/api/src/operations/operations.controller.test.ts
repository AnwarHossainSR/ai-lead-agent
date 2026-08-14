import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestApp } from "../testing/app";
import { QSTASH_CLIENT, type QStashDlqClient } from "./qstash-client.provider";

/**
 * API tests for the operations endpoints (task 8.1/8.3): queue configuration
 * with a real dead-letter count, a failed-jobs list with a reason, the retry
 * action, and that the panel degrades when QStash — the actual dependency
 * behind this view, in place of the Redis-backed queue design.md originally
 * assumed — is unreachable.
 */

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function fakeQstash(overrides: Partial<QStashDlqClient["dlq"]> = {}): QStashDlqClient {
  return {
    dlq: {
      listMessages: vi.fn().mockResolvedValue({ messages: [] }),
      retry: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
  };
}

describe("GET /api/operations/queues", () => {
  it("lists every configured queue with its dead-letter count", async () => {
    const qstash = fakeQstash({
      listMessages: vi.fn().mockResolvedValue({
        messages: [
          { dlqId: "dlq-1", url: "https://api.example.com/api/jobs/scoring", createdAt: 1 },
          { dlqId: "dlq-2", url: "https://api.example.com/api/jobs/scoring", createdAt: 2 },
          { dlqId: "dlq-3", url: "https://api.example.com/api/jobs/discovery", createdAt: 3 },
        ],
      }),
    });

    app = await createTestApp({}, [{ token: QSTASH_CLIENT, useValue: qstash }]);

    const response = await request(app.getHttpServer()).get("/api/operations/queues").expect(200);

    const scoring = response.body.find((queue: { name: string }) => queue.name === "scoring");
    const discovery = response.body.find((queue: { name: string }) => queue.name === "discovery");
    const verification = response.body.find(
      (queue: { name: string }) => queue.name === "verification",
    );

    expect(scoring).toMatchObject({ failedCount: 2, concurrency: 8 });
    expect(discovery).toMatchObject({ failedCount: 1, concurrency: 1 });
    expect(verification).toMatchObject({ failedCount: 0 });
  });

  it("degrades when QStash is unreachable", async () => {
    const qstash = fakeQstash({
      listMessages: vi.fn().mockRejectedValue(new Error("QStash did not respond.")),
    });

    app = await createTestApp({}, [{ token: QSTASH_CLIENT, useValue: qstash }]);

    await request(app.getHttpServer()).get("/api/operations/queues").expect(500);
  });
});

describe("GET /api/operations/failed-jobs", () => {
  it("returns the failure reason from the last delivery attempt", async () => {
    const qstash = fakeQstash({
      listMessages: vi.fn().mockResolvedValue({
        messages: [
          {
            dlqId: "dlq-1",
            url: "https://api.example.com/api/jobs/website-analysis",
            createdAt: Date.parse("2026-01-01T00:00:00Z"),
            responseStatus: 500,
            responseBody: "Timed out fetching the target site.",
          },
        ],
      }),
    });

    app = await createTestApp({}, [{ token: QSTASH_CLIENT, useValue: qstash }]);

    const response = await request(app.getHttpServer())
      .get("/api/operations/failed-jobs")
      .expect(200);

    expect(response.body).toEqual([
      {
        dlqId: "dlq-1",
        queueName: "website-analysis",
        url: "https://api.example.com/api/jobs/website-analysis",
        failedAt: "2026-01-01T00:00:00.000Z",
        responseStatus: 500,
        reason: "Timed out fetching the target site.",
      },
    ]);
  });
});

describe("POST /api/operations/failed-jobs/:dlqId/retry", () => {
  it("calls through to QStash's retry and reports success", async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    const qstash = fakeQstash({ retry });

    app = await createTestApp({}, [{ token: QSTASH_CLIENT, useValue: qstash }]);

    const response = await request(app.getHttpServer())
      .post("/api/operations/failed-jobs/dlq-1/retry")
      .expect(200);

    expect(response.body).toEqual({ retried: true });
    expect(retry).toHaveBeenCalledWith("dlq-1");
  });
});
