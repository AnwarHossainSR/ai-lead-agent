import { type Database, pingDatabase } from "@mela/database";
import { Inject, Injectable } from "@nestjs/common";
import { type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";

import { DATABASE } from "../database/database.module";
import { withCheckTimeout } from "./check-timeout";
import { describeFailure } from "./describe-failure";

const DEPENDENCY = "PostgreSQL";

@Injectable()
export class PostgresHealthIndicator {
  constructor(
    private readonly health: HealthIndicatorService,
    @Inject(DATABASE) private readonly database: Database,
  ) {}

  /**
   * `SELECT 1` rather than an inspection of the pool's own state. A pool can
   * believe it holds a live connection to a server that stopped answering; a
   * round trip is the only thing that proves otherwise.
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const session = this.health.check(key);

    try {
      await withCheckTimeout(DEPENDENCY, pingDatabase(this.database));
      return session.up({ message: `${DEPENDENCY} is reachable.` });
    } catch (error) {
      return session.down({ message: describeFailure(DEPENDENCY, error) });
    }
  }
}
