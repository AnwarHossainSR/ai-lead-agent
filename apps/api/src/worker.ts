import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Client } from "@upstash/qstash";

import { QUEUE_CONFIGS } from "@mela/config";
import { hydrateEnvironment, loadApiEnv } from "@mela/config/env";
import { AppModule } from "./app.module";
import { createLogger } from "./logging/create-logger";
import { installErrorHandlers } from "./observability/error-reporter";
import { startMetricsServer, stopMetricsServer } from "./observability/metrics";
import { QueueService } from "./worker/queue.service";

async function bootstrap(): Promise<void> {
  hydrateEnvironment();
  const env = loadApiEnv();

  installErrorHandlers(env.ERROR_REPORTING_DSN);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: createLogger(env.NODE_ENV),
  });

  app.enableShutdownHooks();

  const workerLogger = new Logger("Worker");
  workerLogger.log(`Worker started. Consumed queues: ${Object.keys(QUEUE_CONFIGS).join(", ")}`);

  const qstash = new Client({
    baseUrl: env.QSTASH_URL,
    token: env.QSTASH_TOKEN,
  });

  try {
    await qstash.logs({ count: 1 });
    workerLogger.log("QStash reachable.");
  } catch (error) {
    workerLogger.error(`QStash is unreachable at ${env.QSTASH_URL}. Check the token or network.`);
    await app.close();
    process.exit(1);
  }

  const queueService = new QueueService(qstash, env.QSTASH_URL);
  queueService.setup();

  await startMetricsServer(env.METRICS_PORT);
  workerLogger.log(`Metrics listening on http://localhost:${env.METRICS_PORT}/metrics`);

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
      workerLogger.error(error instanceof Error ? error.message : String(error));
    }

    await stopMetricsServer();
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
