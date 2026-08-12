import { Controller, Get } from "@nestjs/common";
import { HealthCheck, type HealthCheckResult, HealthCheckService } from "@nestjs/terminus";

import { PostgresHealthIndicator } from "./postgres.health";
import { RedisHealthIndicator } from "./redis.health";

/**
 * `GET /health` — unauthenticated, and excluded from the global `/api` prefix
 * so it stays where load balancers, container orchestrators and uptime checks
 * expect to find it.
 *
 * Terminus returns 200 when every indicator is up and 503 when any is down,
 * with the per-dependency detail in the body either way. A check that reported
 * healthy while a dependency was unreachable would be worse than no check.
 */
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly postgres: PostgresHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.postgres.isHealthy("postgres"),
      () => this.redis.isHealthy("redis"),
    ]);
  }
}
