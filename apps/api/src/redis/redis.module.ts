import { type ApiEnv } from "@mela/config/env";
import { Global, Inject, Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import Redis from "ioredis";

import { API_ENV } from "../config/env.module";

/** Injection token for the Redis client. */
export const REDIS = "REDIS";

/**
 * Owns the API's Redis client.
 *
 * Nothing but the health check uses Redis today. That is deliberate: the job
 * queues arrive in a later phase, and discovering a wrong connection string
 * then — with a worker on top of it — is considerably more expensive than
 * discovering it now.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [API_ENV],
      useFactory: (env: ApiEnv): Redis => {
        const client = new Redis(env.REDIS_URL, {
          // Do not dial during startup. The health check is what proves Redis
          // is reachable; the API booting is not.
          lazyConnect: true,
          connectTimeout: 2_000,
          maxRetriesPerRequest: 1,
          // Keep retrying with a ceiling rather than giving up. Returning null
          // here would end the client permanently, so a Redis that came back
          // an hour later would still be reported down.
          retryStrategy: (attempt: number): number => Math.min(attempt * 200, 2_000),
        });

        // ioredis emits `error` on every failed reconnect. Without a listener
        // Node treats it as an unhandled error event and takes the process
        // down — an unreachable dependency would kill the API that exists to
        // report it. Logged at debug so a flapping Redis does not bury the log.
        const logger = new Logger("Redis");
        client.on("error", (error: Error) => {
          logger.debug(`Redis connection error: ${error.name}`);
        });

        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly client: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    // `quit` waits for a reply, which never comes when Redis is already gone.
    // Shutdown must not hang on the thing that was unreachable to begin with.
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
