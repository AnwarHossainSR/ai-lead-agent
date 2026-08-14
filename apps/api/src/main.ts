import "reflect-metadata";

import { EnvironmentValidationError, hydrateEnvironment, loadApiEnv } from "@mela/config/env";
import { Logger } from "@nestjs/common";

import { createApp } from "./create-app";
import { ShutdownState } from "./health/shutdown-state";
import { installErrorHandlers } from "./observability/error-reporter";
import { startMetricsServer, stopMetricsServer } from "./observability/metrics";

async function bootstrap(): Promise<void> {
  hydrateEnvironment();
  const env = loadApiEnv();

  installErrorHandlers(env.ERROR_REPORTING_DSN);

  const app = await createApp(env);
  await app.listen(env.API_PORT);

  await startMetricsServer(env.METRICS_PORT);

  new Logger("Bootstrap").log(`API listening on http://localhost:${env.API_PORT}`);
  new Logger("Bootstrap").log(`Metrics listening on http://localhost:${env.METRICS_PORT}/metrics`);

  const shutdownState = app.get(ShutdownState);

  const shutdown = async (signal: string): Promise<void> => {
    new Logger("Bootstrap").log(`Received ${signal}, shutting down...`);
    shutdownState.markShuttingDown();
    await stopMetricsServer();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger("Bootstrap");

  if (error instanceof EnvironmentValidationError) {
    logger.error(error.message);
  } else {
    logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  }

  process.exit(1);
});
