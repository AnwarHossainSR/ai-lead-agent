import { randomUUID } from "node:crypto";
import type { OnApplicationShutdown } from "@nestjs/common";
import { Logger } from "@nestjs/common";

import { getCorrelationId, runWithCorrelation } from "../logging/correlation-context";
import { type JobName, type JobPayload, resolveJobDefinition } from "./jobs.registry";
import type { QueueService } from "./queue.service";

export class JobService implements OnApplicationShutdown {
  private readonly logger = new Logger("JobService");

  constructor(private readonly queueService: QueueService) {}

  validatePayload<T extends JobName>(name: T, raw: unknown): JobPayload<T> {
    const definition = resolveJobDefinition(name);
    const result = definition.payloadSchema.safeParse(raw);

    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new ValidationError(name, fields);
    }

    return result.data as JobPayload<T>;
  }

  async enqueue<T extends JobName>(
    name: T,
    payload: unknown,
    options?: { delay?: number; cron?: string },
  ): Promise<void> {
    const definition = resolveJobDefinition(name);
    const parsed = this.validatePayload(name, payload);

    // Copy the current correlation identifier into the payload so the job
    // inherits the request's identifier when enqueued during request handling.
    const correlationId = getCorrelationId();
    const enriched = correlationId !== undefined ? { ...parsed, correlationId } : parsed;

    await this.queueService.publish(definition.queueName, enriched, options);
  }

  wrapProcessor<T extends JobName>(
    name: T,
    processor: (payload: JobPayload<T>) => Promise<Skipped | undefined>,
  ): (payload: JobPayload<T>) => Promise<Skipped | undefined> {
    return async (payload: JobPayload<T>): Promise<Skipped | undefined> => {
      try {
        const validated = this.validatePayload(name, payload);

        // Open a correlation context per job. Scheduled jobs without an
        // originating request get their own identifier.
        const correlationId =
          (validated as { correlationId?: string }).correlationId ?? randomUUID();

        return await runWithCorrelation({ correlationId, role: "worker" }, () =>
          processor(validated),
        );
      } catch (error) {
        if (error instanceof ValidationError) {
          this.logger.error(`Validation failed: ${error.message}`);
          throw error;
        }

        throw error;
      }
    };
  }

  async onApplicationShutdown(): Promise<void> {
    // Queue shutdown is handled by QueueService.
  }
}

export class ValidationError extends Error {
  readonly jobType: string;
  readonly invalidFields: string;

  constructor(jobType: string, invalidFields: string) {
    super(`Job "${jobType}" has invalid payload fields: ${invalidFields}.`);
    this.name = "ValidationError";
    this.jobType = jobType;
    this.invalidFields = invalidFields;
  }
}

export class Skipped {
  readonly _tag = "skipped";

  constructor(public readonly reason: string) {}
}
