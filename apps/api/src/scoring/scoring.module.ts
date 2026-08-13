import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { ScoringController } from "./scoring.controller";
import { ScoringService } from "./scoring.service";

@Module({
  imports: [DatabaseModule],
  controllers: [ScoringController],
  providers: [ScoringService],
})
export class ScoringModule {}
