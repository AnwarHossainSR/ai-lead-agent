import { Module } from "@nestjs/common";

import { AIModule } from "./ai/ai.module";
import { AnalysisModule } from "./analysis/analysis.module";
import { EnvModule } from "./config/env.module";
import { DatabaseModule } from "./database/database.module";
import { DiscoveryModule } from "./discovery/discovery.module";
import { HealthModule } from "./health/health.module";
import { RedisModule } from "./redis/redis.module";
import { VerificationModule } from "./verification/verification.module";

/**
 * The application shell. Four modules, no domain behaviour: this change
 * establishes that the API starts, reaches its dependencies and reports on
 * them. Discovery, research, scoring and outreach arrive as their own modules
 * in later phases.
 */
@Module({
  imports: [
    EnvModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    AIModule,
    DiscoveryModule,
    VerificationModule,
    AnalysisModule,
  ],
})
export class AppModule {}
