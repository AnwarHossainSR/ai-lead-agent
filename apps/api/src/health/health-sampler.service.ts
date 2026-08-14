import { type Database, pingDatabase, recordDependencyHealthSample } from "@mela/database";
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import type Redis from "ioredis";

import { DATABASE } from "../database/database.module";
import { REDIS } from "../redis/redis.module";
import { withCheckTimeout } from "./check-timeout";
import { describeFailure } from "./describe-failure";

/**
 * One sample per dependency per minute (design D6).
 *
 * Fast enough to fill a 90-segment bar in an hour and a half, cheap enough at
 * one small row per dependency per minute. Retention, if it ever becomes a
 * question, is a prune job — not a change to this shape.
 */
export const HEALTH_SAMPLE_INTERVAL_MS = 60_000;

interface Probe {
  readonly dependency: string;
  readonly run: () => Promise<void>;
}

/**
 * Writes the reachability samples the API status screen's uptime bar renders.
 *
 * The probes are the *same* round trips the health indicators make — a `SELECT
 * 1` and a `PING`, through the same timeout helper — rather than a second,
 * subtly different definition of "up". A status page that disagrees with
 * `/health` about whether the database is reachable is worse than no status
 * page.
 *
 * A probe that itself fails to record writes nothing and logs. That is the
 * correct outcome: an unrecorded minute is rendered as unsampled, which is
 * true, and inventing a row to avoid a gap is the one thing design D6 exists
 * to prevent.
 */
@Injectable()
export class HealthSamplerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(HealthSamplerService.name);
  private timer: NodeJS.Timeout | null = null;
  private sampling = false;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /**
   * A plain interval rather than a scheduled job.
   *
   * `add-background-jobs` owns scheduled maintenance and is unimplemented; a
   * one-minute probe does not justify blocking on it, and does not justify a
   * new dependency either. The timer is `unref`'d so it never keeps the
   * process alive — a booted-but-idle API should still exit.
   */
  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      void this.sampleSafely();
    }, HEALTH_SAMPLE_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Skips a tick that arrives while the previous one is still running, so a
   * dependency timing out at 30 seconds cannot stack probes on top of it.
   */
  private async sampleSafely(): Promise<void> {
    if (this.sampling) return;
    this.sampling = true;
    try {
      await this.sampleOnce();
    } finally {
      this.sampling = false;
    }
  }

  private probes(): readonly Probe[] {
    return [
      {
        dependency: "postgres",
        run: () => withCheckTimeout("PostgreSQL", pingDatabase(this.database)),
      },
      {
        dependency: "redis",
        run: async () => {
          await withCheckTimeout("Redis", this.redis.ping());
        },
      },
    ];
  }

  /** Probes every dependency once and stores what each one did. */
  async sampleOnce(): Promise<void> {
    for (const probe of this.probes()) {
      const startedAt = Date.now();

      try {
        await probe.run();
        await this.store(probe.dependency, {
          status: "up",
          latencyMs: Date.now() - startedAt,
          failureReason: null,
        });
      } catch (error) {
        await this.store(probe.dependency, {
          status: "down",
          latencyMs: null,
          failureReason: describeFailure(probe.dependency, error),
        });
      }
    }
  }

  private async store(
    dependency: string,
    result: {
      status: "up" | "degraded" | "down";
      latencyMs: number | null;
      failureReason: string | null;
    },
  ): Promise<void> {
    try {
      await recordDependencyHealthSample(this.database, { dependency, ...result });
    } catch (error) {
      // Postgres being down is exactly when its own sample cannot be written.
      // The minute goes unrecorded and the bar shows it as unsampled, which is
      // the truth; a retry here would only delay the same outcome.
      this.logger.warn(
        `Could not record a health sample for ${dependency}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
