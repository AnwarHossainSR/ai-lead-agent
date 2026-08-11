import { type ApiEnv } from "@mela/config/env";
import { type INestApplication, RequestMethod } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { createLogger } from "./logging/create-logger";
import { ZodValidationPipe } from "./validation/zod-validation.pipe";

/**
 * Applies every application-wide setting.
 *
 * Split out from `createApp` so the tests can build an application from a
 * testing module — with a provider or two overridden — and still get the same
 * global prefix, the same pipe and the same CORS policy the deployed process
 * runs with. A test against a differently-configured application proves very
 * little about the one that ships.
 */
export function configureApp(app: INestApplication, env: ApiEnv): INestApplication {
  // Application routes live under /api. `/health` is deliberately outside it:
  // orchestrators, load balancers and uptime monitors look for a health
  // endpoint at the root, and moving it costs a configuration line in every
  // one of them.
  app.setGlobalPrefix("api", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  // Zod rather than Nest's class-validator ValidationPipe: the project
  // validates with Zod everywhere else, and two validation systems means a
  // rule enforced in one of them and forgotten in the other.
  app.useGlobalPipes(new ZodValidationPipe());

  // Exactly one origin. A wildcard on an API that will later carry lead data
  // is not a default worth inheriting.
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });

  // Runs the modules' onApplicationShutdown hooks, which is what closes the
  // PostgreSQL pool and the Redis client.
  app.enableShutdownHooks();

  return app;
}

/** Builds the configured application without listening on a port. */
export async function createApp(env: ApiEnv): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: createLogger(env.NODE_ENV) });
  return configureApp(app, env);
}
