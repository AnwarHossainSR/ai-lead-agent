import { Module } from "@nestjs/common";

import { DATABASE } from "../database/database.module";

import { VerificationController } from "./verification.controller";
import { BatchVerificationController } from "./batch-verification.controller";
import { VerificationService } from "./verification.service";

/**
 * The verification module owns the API surface and orchestration for
 * company verification (design D3). It exposes the endpoints that trigger
 * and inspect verification runs.
 */
@Module({
  controllers: [VerificationController, BatchVerificationController],
  providers: [
    {
      provide: VerificationService,
      inject: [DATABASE],
      useFactory: (database: unknown) => new VerificationService(database as any),
    },
  ],
})
export class VerificationModule {}
