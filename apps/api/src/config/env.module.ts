import { type ApiEnv, hydrateEnvironment, loadApiEnv } from "@mela/config/env";
import { Global, Module } from "@nestjs/common";

/** Injection token for the validated, frozen API environment. */
export const API_ENV = "API_ENV";

/**
 * Makes the validated environment injectable.
 *
 * The parse itself lives in `@mela/config`, which is the only package allowed
 * to touch `process.env`. This module exposes the frozen result and nothing
 * else, so no provider anywhere needs to know where a value came from or
 * whether it was checked.
 *
 * Global because configuration is genuinely ambient: every module that needs a
 * connection string needs the same object, and threading an import through
 * each of them would document nothing.
 */
@Global()
@Module({
  providers: [
    {
      provide: API_ENV,
      useFactory: (): ApiEnv => {
        // `main.ts` already did both of these before Nest existed. Both are
        // idempotent — the loader memoises, and `hydrateEnvironment` never
        // overwrites a variable that is already set — so a test that boots the
        // module directly gets the same object without a separate code path.
        hydrateEnvironment();
        return loadApiEnv();
      },
    },
  ],
  exports: [API_ENV],
})
export class EnvModule {}
