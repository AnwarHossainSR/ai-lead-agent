import { type ApiEnv } from "@mela/config/env";
import { Module } from "@nestjs/common";
import { TerminusModule, type TerminusAsyncModuleOptions } from "@nestjs/terminus";

import { API_ENV } from "../config/env.module";
import { HealthController } from "./health.controller";
import { PostgresHealthIndicator } from "./postgres.health";
import { RedisHealthIndicator } from "./redis.health";

@Module({
  imports: [
    TerminusModule.forRootAsync({
      inject: [API_ENV],
      useFactory: (env: ApiEnv): TerminusAsyncModuleOptions => ({
        // Terminus logs failed checks itself. Its pretty style draws a box
        // around them, which is unreadable in an aggregator, so the style
        // follows the same rule as the rest of the logging: pretty for a human
        // at a terminal, JSON everywhere else.
        //
        // What it logs is the indicator's own message, which
        // `describeFailure` has already stripped of anything driver-supplied.
        errorLogStyle: env.NODE_ENV === "development" ? "pretty" : "json",
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [PostgresHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
