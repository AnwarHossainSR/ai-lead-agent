import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { ResearchController } from "./research.controller";
import { ResearchService } from "./research.service";

/**
 * The research module owns contact research for companies.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [ResearchController],
  providers: [ResearchService],
  exports: [ResearchService],
})
export class ResearchModule {}
