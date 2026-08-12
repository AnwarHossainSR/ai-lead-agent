import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";
import { BrowserCaptureService } from "./browser-capture.service";
import { ArtifactService } from "./artifact.service";
import { PolitenessService } from "./politeness.service";
import { RobotsService } from "../http/robots";

/**
 * The analysis module owns website analysis for companies.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    BrowserCaptureService,
    {
      provide: ArtifactService,
      useFactory: () => new ArtifactService(),
    },
    {
      provide: RobotsService,
      useFactory: () =>
        new RobotsService({
          fetchRobotsTxt: async (url: string) => {
            const response = await fetch(url);
            return response.text();
          },
        }),
    },
    PolitenessService,
  ],
  exports: [AnalysisService],
})
export class AnalysisModule {}
