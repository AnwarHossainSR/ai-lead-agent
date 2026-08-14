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
  const env: ApiEnv = { ...loadApiEnv(), ...overrides };

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
