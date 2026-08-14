import { type ApiEnv } from "@mela/config/env";
import { Global, Module } from "@nestjs/common";
import { type TerminusAsyncModuleOptions, TerminusModule } from "@nestjs/terminus";

import { API_ENV } from "../config/env.module";
import { DatabaseModule } from "../database/database.module";
import { HealthHistoryController } from "./health-history.controller";
import { HealthSamplerService } from "./health-sampler.service";
import { HealthController } from "./health.controller";
import { PostgresHealthIndicator } from "./postgres.health";
import { RedisHealthIndicator } from "./redis.health";

@Global()
@Module({
  imports: [
    DatabaseModule,
    TerminusModule.forRootAsync({
      inject: [API_ENV],
      useFactory: (env: ApiEnv): TerminusAsyncModuleOptions => ({
        errorLogStyle: env.NODE_ENV === "development" ? "pretty" : "json",
      }),
    }),
  ],
  controllers: [HealthController, HealthHistoryController],
  providers: [PostgresHealthIndicator, RedisHealthIndicator, HealthSamplerService],
})
export class HealthModule {}
