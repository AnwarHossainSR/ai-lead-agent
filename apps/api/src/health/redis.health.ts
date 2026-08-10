import { Inject, Injectable } from "@nestjs/common";
import { type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";
import type Redis from "ioredis";

import { REDIS } from "../redis/redis.module";
import { withCheckTimeout } from "./check-timeout";
import { describeFailure } from "./describe-failure";

const DEPENDENCY = "Redis";

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly health: HealthIndicatorService,
    @Inject(REDIS) private readonly client: Redis,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const session = this.health.check(key);

    try {
      // The client is lazy, so this also covers the first connection. With
      // Redis down the command waits in ioredis' offline queue, which is
      // exactly the case the timeout is here to bound.
      await withCheckTimeout(DEPENDENCY, this.client.ping());
      return session.up({ message: `${DEPENDENCY} is reachable.` });
    } catch (error) {
      return session.down({ message: describeFailure(DEPENDENCY, error) });
    }
  }
}
