import { type ApiEnv } from "@mela/config/env";
import { Global, Module } from "@nestjs/common";
import { type TerminusAsyncModuleOptions, TerminusModule } from "@nestjs/terminus";

import { API_ENV } from "../config/env.module";
import { HealthController } from "./health.controller";
import { PostgresHealthIndicator } from "./postgres.health";
import { RedisHealthIndicator } from "./redis.health";
import { SHUTDOWN_STATE, ShutdownState } from "./shutdown-state";

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
  providers: [
    PostgresHealthIndicator,
    RedisHealthIndicator,
    { provide: SHUTDOWN_STATE, useClass: ShutdownState },
  ],
  exports: [SHUTDOWN_STATE],
})
export class HealthModule {}
