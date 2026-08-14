import { type ApiEnv } from "@mela/config/env";
import { Global, Module } from "@nestjs/common";
import { type TerminusAsyncModuleOptions, TerminusModule } from "@nestjs/terminus";

import { API_ENV } from "../config/env.module";
import { HealthController } from "./health.controller";
import { PostgresHealthIndicator } from "./postgres.health";
import { RedisHealthIndicator } from "./redis.health";
import { ShutdownState } from "./shutdown-state";

@Global()
@Module({
  imports: [
    TerminusModule.forRootAsync({
      inject: [API_ENV],
      useFactory: (env: ApiEnv): TerminusAsyncModuleOptions => ({
        errorLogStyle: env.NODE_ENV === "development" ? "pretty" : "json",
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [PostgresHealthIndicator, RedisHealthIndicator, ShutdownState],
  exports: [ShutdownState],
})
export class HealthModule {}
