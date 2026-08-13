import type { OnApplicationShutdown } from "@nestjs/common";
import { Logger } from "@nestjs/common";

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
    await this.queueService.publish(definition.queueName, parsed, options);
  }

  wrapProcessor<T extends JobName>(
    name: T,
    processor: (payload: JobPayload<T>) => Promise<Skipped | undefined>,
  ): (payload: JobPayload<T>) => Promise<Skipped | undefined> {
    return async (payload: JobPayload<T>): Promise<Skipped | undefined> => {
      try {
        const validated = this.validatePayload(name, payload);
        return await processor(validated);
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
