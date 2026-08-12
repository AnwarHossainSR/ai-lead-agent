import { Module } from "@nestjs/common";

import { AIModule } from "../ai/ai.module";
import { DatabaseModule } from "../database/database.module";
import { OpportunityAnalysisController } from "./opportunity-analysis.controller";
import { OpportunityAnalysisService } from "./opportunity-analysis.service";

/**
 * The opportunity module owns the API surface and orchestration for
 * opportunity analysis runs (design D3/D4). It exposes the endpoints that
 * trigger and inspect runs, and wires the service to the database and AI.
 */
@Module({
  imports: [DatabaseModule, AIModule],
  controllers: [OpportunityAnalysisController],
  providers: [OpportunityAnalysisService],
})
export class OpportunityModule {}
