import type { RateLimitStatus, SpendReport } from "@mela/database";
import { Controller, Get, HttpCode, Param, Post } from "@nestjs/common";

import { type FailedJob, OperationsService, type QueueSummary } from "./operations.service";

@Controller("operations")
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get("queues")
  async getQueues(): Promise<QueueSummary[]> {
    return this.operationsService.getQueues();
  }

  @Get("failed-jobs")
  async getFailedJobs(): Promise<FailedJob[]> {
    return this.operationsService.getFailedJobs();
  }

  /** Spend for the ceiling's own window, with the ceiling and what remains. */
  @Get("spend")
  async getSpend(): Promise<SpendReport> {
    return this.operationsService.getSpend();
  }

  /** Configured per-source limits, and what is recorded about their use. */
  @Get("rate-limits")
  async getRateLimits(): Promise<readonly RateLimitStatus[]> {
    return this.operationsService.getRateLimits();
  }

  /**
   * Retrying an unknown dlqId is rejected by QStash itself; that failure
   * propagates as-is rather than being reinterpreted here.
   */
  @Post("failed-jobs/:dlqId/retry")
  @HttpCode(200)
  async retryFailedJob(@Param("dlqId") dlqId: string): Promise<{ retried: true }> {
    await this.operationsService.retryFailedJob(dlqId);
    return { retried: true };
  }
}
