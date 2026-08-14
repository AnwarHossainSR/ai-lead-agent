/** One configured job queue and how many of its messages are in QStash's dead-letter queue. */
export interface QueueSummary {
  readonly name: string;
  readonly concurrency: number;
  readonly attempts: number;
  readonly backoffMs: number;
  readonly timeoutMs: number;
  readonly failedCount: number;
}

/** One message that exhausted its retries — `GET /api/operations/failed-jobs`. */
export interface FailedJob {
  readonly dlqId: string;
  readonly queueName: string;
  readonly url: string;
  readonly failedAt: string;
  readonly responseStatus: number | null;
  readonly reason: string;
}
