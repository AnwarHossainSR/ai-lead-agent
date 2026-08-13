import { type OnApplicationShutdown } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";

import { resolveJobDefinition, type JobName, type JobPayload } from "./jobs.registry";
import { QueueService } from "./queue.service";

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

  async enqueue<T extends JobName>(name: T, payload: unknown, jobId?: string): Promise<Job> {
    const definition = resolveJobDefinition(name);
    const parsed = this.validatePayload(name, payload);
    const managedQueue = this.queueService.getQueue(definition.queueName);

    if (managedQueue === undefined) {
      throw new Error(`Queue "${definition.queueName}" is not registered.`);
    }

    const subjectId = definition.getSubjectId(parsed);
    const deterministicJobId = jobId ?? `${name}-${subjectId}`;

    this.logger.log(`Enqueuing job "${name}" with id "${deterministicJobId}".`);
    return managedQueue.queue.add(name, parsed, { jobId: deterministicJobId });
  }

  wrapProcessor<T extends JobName>(
    name: T,
    processor: (payload: JobPayload<T>, job: Job) => Promise<Skipped | void>,
  ): (job: Job) => Promise<void> {
    return async (job: Job): Promise<void> => {
      if (!job.data || typeof job.data !== "object") {
        throw new ValidationError(name, "(root) — expected an object payload.");
      }

      try {
        const payload = this.validatePayload(name, job.data);
        const result = await processor(payload, job);

        if (result instanceof Skipped) {
          this.logger.log(`Job "${name}" skipped: ${result.reason}`);
          return;
        }
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
