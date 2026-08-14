import { type ApiEnv, loadApiEnv } from "@mela/config/env";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { AppModule } from "../app.module";
import { API_ENV } from "../config/env.module";
import { configureApp } from "../create-app";
import { silentLogger } from "./silent-logger";

/** A provider token to substitute, e.g. a fake QStash client that never leaves the process. */
export interface ProviderOverride {
  readonly token: string;
  readonly useValue: unknown;
}

/**
 * The `SESSION_SECRET` every `createTestApp()` call uses unless overridden —
 * exported so a test can compute a matching session-token hash without
 * booting an app first.
 */
export const TEST_SESSION_SECRET = "changeme-generate-a-real-secret-with-openssl-rand-hex-32";

/**
 * Placeholder values for required environment variables that have no default
 * and are not set in the CI environment. `DATABASE_URL` and `REDIS_URL` are
 * intentionally omitted — they come from `process.env` where the CI workflow
 * provisions real PostgreSQL and Redis service containers.
 */
const TEST_ENV: Record<string, string> = {
  NODE_ENV: "development",
  GEMINI_API_KEY: "test-gemini-key",
  CLOUDFLARE_ACCOUNT_ID: "test-cf-account",
  CLOUDFLARE_API_TOKEN: "test-cf-token",
  QSTASH_TOKEN: "test-qstash-token",
  SESSION_SECRET: TEST_SESSION_SECRET,
};

/**
 * Boots the real application — real modules, real pool, real Redis client —
 * with the environment optionally amended.
 *
 * Amending the environment is how the "dependency is down" scenarios are
 * reached: pointing `DATABASE_URL` at a closed port produces exactly what a
 * stopped PostgreSQL produces, without stopping the container the rest of the
 * suite and the developer's other terminal are using.
 *
 * `providerOverrides` is for dependencies that are not reachable this way —
 * a third-party client this test suite must never call for real (QStash) —
 * where a fake value is substituted directly instead of pointed at a broken
 * connection string.
 */
export async function createTestApp(
  overrides: Partial<ApiEnv> = {},
  providerOverrides: readonly ProviderOverride[] = [],
): Promise<INestApplication> {
  const env: ApiEnv = { ...loadApiEnv({ ...process.env, ...TEST_ENV }), ...overrides };

  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(API_ENV)
    .useValue(env);

  for (const { token, useValue } of providerOverrides) {
    builder = builder.overrideProvider(token).useValue(useValue);
  }

  const moduleRef = await builder.setLogger(silentLogger).compile();

  const app = configureApp(moduleRef.createNestApplication(), env);
  await app.init();

  return app;
}

/**
 * A host and port that refuses connections immediately. Port 1 is reserved and
 * nothing listens on it, so the driver gets ECONNREFUSED rather than hanging.
 */
export const CLOSED_PORT_URL = {
  /** The password is distinctive so a test can prove it never leaves the process. */
  password: "s3cret-must-never-appear",
  postgres: "postgresql://mela:s3cret-must-never-appear@127.0.0.1:1/mela",
  redis: "redis://:s3cret-must-never-appear@127.0.0.1:1",
} as const;
