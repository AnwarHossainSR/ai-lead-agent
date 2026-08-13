import type { OnApplicationShutdown } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import type { Client } from "@upstash/qstash";

import { QUEUE_CONFIGS, type QueueConfig } from "@mela/config";

export interface ManagedQueue {
  name: string;
  config: QueueConfig;
}

export class QueueService implements OnApplicationShutdown {
  private readonly logger = new Logger("QueueService");
  private readonly queues = new Map<string, ManagedQueue>();
  private shuttingDown = false;

  constructor(
    private readonly qstash: Client,
    private readonly baseUrl: string,
  ) {}

  setup(): void {
    for (const [name, config] of Object.entries(QUEUE_CONFIGS)) {
      this.queues.set(name, {
        name,
        config,
      });
    }

    this.logger.log(
      `Registered ${this.queues.size} queues: ${Array.from(this.queues.keys()).join(", ")}`,
    );
    this.logger.log(`QStash base URL: ${this.baseUrl}`);
  }

  getQueue(name: string): ManagedQueue | undefined {
    return this.queues.get(name);
  }

  async publish(
    name: string,
    payload: unknown,
    options?: { delay?: number; cron?: string },
  ): Promise<void> {
    const queue = this.getQueue(name);

    if (queue === undefined) {
      throw new Error(`Queue "${name}" is not registered.`);
    }

    const url = `${this.baseUrl.replace(/\/$/, "")}/api/jobs/${name}`;

    this.logger.log(`Publishing job "${name}" to QStash.`);

    const publishOptions: any = {
      url,
      body: payload,
    };

    if (options?.delay) {
      publishOptions.delay = options.delay;
    }

    if (options?.cron) {
      publishOptions.cron = options.cron;
    }

    const response = (await this.qstash.publish(publishOptions)) as {
      messageId: string;
    };

    this.logger.log(`Job "${name}" published successfully. Message ID: ${response.messageId}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.shutdown();
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;
    this.logger.log("Shutting down queue service...");
    this.logger.log("Queue service shutdown complete.");
  }
}
