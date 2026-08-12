import { Module } from "@nestjs/common";

import { DATABASE } from "../database/database.module";

import { DiscoveryController } from "./discovery.controller";
import { RunService } from "./run.service";

/**
 * The discovery module owns the API surface and orchestration for company
 * discovery runs (design D6). It exposes the endpoints that trigger and
 * inspect runs, and wires the run service to the database.
 */
@Module({
  controllers: [DiscoveryController],
  providers: [
    {
      provide: RunService,
      inject: [DATABASE],
      useFactory: () => new RunService(),
    },
  ],
})
export class DiscoveryModule {}
