import { type OnApplicationShutdown } from "@nestjs/common";
import { Logger } from "@nestjs/common";

import { QUEUE_CONFIGS, type QueueConfig } from "@mela/config";
import type Redis from "ioredis";
import { Queue } from "bullmq";

export interface ManagedQueue {
  name: string;
  config: QueueConfig;
  queue: Queue;
}

export class QueueService implements OnApplicationShutdown {
  private readonly logger = new Logger("QueueService");
  private readonly queues = new Map<string, ManagedQueue>();
  private shuttingDown = false;

  constructor(private readonly redis: Redis, private readonly prefix = "") {}

  setup(): void {
    for (const [name, config] of Object.entries(QUEUE_CONFIGS)) {
      const queue = new Queue(name, {
        connection: this.redis,
        prefix: this.prefix || undefined,
        defaultJobOptions: {
          attempts: config.attempts,
          backoff: { type: "exponential", delay: config.backoff },
        },
      });

      this.queues.set(name, { name, config, queue });
    }

    this.logger.log(`Registered ${this.queues.size} queues: ${Array.from(this.queues.keys()).join(", ")}`);
  }

  getQueue(name: string): ManagedQueue | undefined {
    return this.queues.get(name);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.shutdown();
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;
    this.logger.log("Shutting down queues, waiting for active jobs...");

    await Promise.all(
      Array.from(this.queues.values()).map(({ queue }) => queue.close()),
    );

    this.logger.log("Queues closed.");
  }
}
