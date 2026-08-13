import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { loadApiEnv } from "@mela/config/env";
import { QUEUE_CONFIGS } from "@mela/config";
import { AppModule } from "./app.module";
import { createLogger } from "./logging/create-logger";
import { QueueService } from "./worker/queue.service";
import { REDIS } from "./redis/redis.module";

async function bootstrap(): Promise<void> {
  const env = loadApiEnv();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: createLogger(env.NODE_ENV),
  });

  app.enableShutdownHooks();

  const workerLogger = new Logger("Worker");
  workerLogger.log(`Worker started. Consumed queues: ${Object.keys(QUEUE_CONFIGS).join(", ")}`);

  const redis = app.get(REDIS);
  try {
    await redis.ping();
    workerLogger.log("Redis reachable.");
  } catch (error) {
    workerLogger.error(
      `Redis is unreachable at ${env.REDIS_URL}. Start Redis (docker compose up -d redis) or check the connection string.`,
    );
    await app.close();
    process.exit(1);
  }

  const queueService = new QueueService(redis);
  queueService.setup();

  const shutdown = async (signal: string): Promise<void> => {
    workerLogger.log(`Received ${signal}, shutting down gracefully...`);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Graceful shutdown timed out after ${env.WORKER_SHUTDOWN_TIMEOUT_MS}ms`));
      }, env.WORKER_SHUTDOWN_TIMEOUT_MS);
    });

    try {
      await Promise.race([queueService.shutdown(), timeoutPromise]);
    } catch (error) {
      workerLogger.error(
        error instanceof Error ? error.message : String(error),
      );
    }

    await app.close();
    workerLogger.log("Shutdown complete.");
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger("Worker");

  if (error instanceof Error) {
    logger.error(error.stack ?? error.message);
  } else {
    logger.error(String(error));
  }

  process.exit(1);
});
