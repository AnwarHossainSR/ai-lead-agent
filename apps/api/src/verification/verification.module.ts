import { Module } from "@nestjs/common";

import { BatchVerificationController } from "./batch-verification.controller";
import { VerificationController } from "./verification.controller";
import { VerificationService } from "./verification.service";

/**
 * The verification module owns the API surface and orchestration for
 * company verification (design D3). It exposes the endpoints that trigger
 * and inspect verification runs.
 */
@Module({
  controllers: [VerificationController, BatchVerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
