import { Inject, Injectable } from "@nestjs/common";

import { DISCOVERY_SOURCES, QUEUE_CONFIGS } from "@mela/config";
import type { ApiEnv } from "@mela/config/env";
import {
  type Database,
  type RateLimitStatus,
  type SpendReport,
  readRateLimits,
  readSpend,
} from "@mela/database";
import { API_ENV } from "../config/env.module";
import { DATABASE } from "../database/database.module";
import { QSTASH_CLIENT, type QStashDlqClient } from "./qstash-client.provider";

export interface QueueSummary {
  readonly name: string;
  readonly concurrency: number;
  readonly attempts: number;
  readonly backoffMs: number;
  readonly timeoutMs: number;
  /** Messages for this queue currently sitting in QStash's dead-letter queue. */
  readonly failedCount: number;
}

export interface FailedJob {
  readonly dlqId: string;
  readonly queueName: string;
  readonly url: string;
  readonly failedAt: string;
  readonly responseStatus: number | null;
  readonly reason: string;
}

const MAX_DLQ_MESSAGES = 200;
const MAX_REASON_LENGTH = 500;

/**
 * A job is published to `${baseUrl}/api/jobs/${queueName}`; the queue name is
 * the last path segment. This is the only place a failed message's URL is
 * mapped back to the queue it belongs to.
 */
function parseQueueName(url: string): string {
  const segments = url.split("/").filter((segment) => segment.length > 0);
  return segments.at(-1) ?? "unknown";
}

function summarizeReason(responseStatus?: number, responseBody?: string): string {
  if (responseBody === undefined || responseBody.trim().length === 0) {
    return responseStatus === undefined
      ? "No response recorded for the failed delivery."
      : `Delivery failed with HTTP ${responseStatus} and no response body.`;
  }

  return responseBody.length > MAX_REASON_LENGTH
    ? `${responseBody.slice(0, MAX_REASON_LENGTH)}…`
    : responseBody;
}

/**
 * Jobs run through Upstash QStash (HTTP push), not a pollable local queue, so
 * there is no "pending count" to report — only what QStash actually exposes:
 * each queue's configuration and how many of its messages have exhausted
 * their retries and landed in the dead-letter queue.
 */
@Injectable()
export class OperationsService {
  constructor(
    @Inject(QSTASH_CLIENT) private readonly qstash: QStashDlqClient,
    @Inject(DATABASE) private readonly database: Database,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  /**
   * Model spend against the ceiling that governs it.
   *
   * The window and the ceiling come from the same environment values the AI
   * service enforces, so the panel reports the limit actually in force rather
   * than a second copy of it that could drift.
   */
  async getSpend(): Promise<SpendReport> {
    return readSpend(this.database, {
      windowHours: this.env.AI_SPEND_WINDOW_HOURS,
      ceilingUsd: this.env.AI_SPEND_CEILING_USD,
    });
  }

  /**
   * Each configured discovery source's rate limit, and what the database can
   * honestly say about its use — which today is the last time a run used it,
   * and explicitly *not* a request count, because none is persisted.
   */
  async getRateLimits(): Promise<readonly RateLimitStatus[]> {
    return readRateLimits(
      this.database,
      DISCOVERY_SOURCES.map((source) => ({
        id: source.id,
        name: source.name,
        enabled: source.enabled,
        maxRequestRatePerMinute: source.maxRequestRatePerMinute,
      })),
    );
  }

  async getQueues(): Promise<QueueSummary[]> {
    const { messages } = await this.qstash.dlq.listMessages({ count: MAX_DLQ_MESSAGES });

    const failedCounts = new Map<string, number>();
    for (const message of messages) {
      const queueName = parseQueueName(message.url);
      failedCounts.set(queueName, (failedCounts.get(queueName) ?? 0) + 1);
    }

    return Object.entries(QUEUE_CONFIGS).map(([name, config]) => ({
      name,
      concurrency: config.concurrency,
      attempts: config.attempts,
      backoffMs: config.backoff,
      timeoutMs: config.timeout,
      failedCount: failedCounts.get(name) ?? 0,
    }));
  }

  async getFailedJobs(): Promise<FailedJob[]> {
    const { messages } = await this.qstash.dlq.listMessages({ count: MAX_DLQ_MESSAGES });

    return messages
      .map((message) => ({
        dlqId: message.dlqId,
        queueName: parseQueueName(message.url),
        url: message.url,
        failedAt: new Date(message.createdAt).toISOString(),
        responseStatus: message.responseStatus ?? null,
        reason: summarizeReason(message.responseStatus, message.responseBody),
      }))
      .sort((left, right) => left.failedAt.localeCompare(right.failedAt));
  }

  async retryFailedJob(dlqId: string): Promise<void> {
    await this.qstash.dlq.retry(dlqId);
  }
}
