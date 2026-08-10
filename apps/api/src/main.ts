import "reflect-metadata";

import { EnvironmentValidationError, hydrateEnvironment, loadApiEnv } from "@mela/config/env";
import { Logger } from "@nestjs/common";

import { createApp } from "./create-app";

async function bootstrap(): Promise<void> {
  // Both before Nest exists, so a missing variable fails here with a message
  // naming it rather than somewhere inside a provider factory.
  hydrateEnvironment();
  const env = loadApiEnv();

  const app = await createApp(env);
  await app.listen(env.API_PORT);

  new Logger("Bootstrap").log(`API listening on http://localhost:${env.API_PORT}`);
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger("Bootstrap");

  if (error instanceof EnvironmentValidationError) {
    // Already free of raw values — the loader strips them out — and already
    // names each variable and what it is for. A stack trace would add noise
    // and no information.
    logger.error(error.message);
  } else {
    logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  }

  process.exit(1);
});
