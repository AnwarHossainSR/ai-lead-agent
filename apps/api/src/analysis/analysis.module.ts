import { Module } from "@nestjs/common";

import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";

/**
 * The analysis module owns the API surface and orchestration for
 * website analysis.
 */
@Module({
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
