import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { ResearchSummaryController } from "./research-summary.controller";
import { ResearchSummaryService } from "./research-summary.service";

@Module({
  imports: [DatabaseModule],
  controllers: [ResearchSummaryController],
  providers: [ResearchSummaryService],
})
export class ResearchSummaryModule {}
