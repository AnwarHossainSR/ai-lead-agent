import { Controller, Get } from "@nestjs/common";
import { HealthCheck, type HealthCheckResult, HealthCheckService } from "@nestjs/terminus";

import { Public } from "../auth/public.decorator";
import { PostgresHealthIndicator } from "./postgres.health";
import { RedisHealthIndicator } from "./redis.health";
import { ShutdownState } from "./shutdown-state";

/**
 * Health endpoints. Each answers a different question:
 *
 * - `/live` — is the process running? Succeeds unless the process is dead.
 * - `/ready` — can it serve work? Fails when a dependency is unreachable
 *   or shutdown has begun.
 * - `/health` — what is the state of each dependency? Unchanged from before.
 */
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly postgres: PostgresHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly shutdownState: ShutdownState,
  ) {}

  @Public()
  @Get("live")
  live(): { status: string } {
    return { status: "ok" };
  }

  @Public()
  @Get("ready")
  async ready(): Promise<HealthCheckResult> {
    if (this.shutdownState.isShuttingDown()) {
      return {
        status: "error",
        details: { shutdown: { status: "down", message: "Shutdown in progress" } },
      };
    }

    return this.health.check([
      () => this.postgres.isHealthy("postgres"),
      () => this.redis.isHealthy("redis"),
    ]);
  }

  @Public()
  @Get("health")
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.postgres.isHealthy("postgres"),
      () => this.redis.isHealthy("redis"),
    ]);
  }
}
