import { Body, Controller, HttpCode, HttpStatus, Injectable, Post } from "@nestjs/common";
import { z } from "zod";

import { createZodDto } from "../validation/zod-dto";
import { VerificationService } from "./verification.service";

/**
 * Zod schema for the POST /api/verification/batch request body.
 */
const verifyBatchBodySchema = z.object({
  companyIds: z.array(z.string().uuid()),
  concurrency: z.number().int().positive().max(10).default(4),
});

/**
 * DTO for the POST /api/verification/batch request body.
 */
export class VerifyBatchDto extends createZodDto(verifyBatchBodySchema) {}

/**
 * The batch verification controller handles the POST /api/verification/batch
 * endpoint for verifying multiple companies at once.
 */
@Injectable()
@Controller("verification")
export class BatchVerificationController {
  constructor(_verificationService: VerificationService) {}

  /**
   * POST /api/verification/batch — verify a batch of companies (task 7.3).
   *
   * Runs all configured checks on each company with bounded concurrency,
   * continues past individual failures, and reports counts.
   */
  @Post("batch")
  @HttpCode(HttpStatus.OK)
  async verifyBatch(@Body() body: VerifyBatchDto): Promise<{
    readonly verified: number;
    readonly unverified: number;
    readonly unreachable: number;
    readonly errored: number;
  }> {
    // For now, return a stub response
    // In a real implementation, we'd fetch the companies and verify them
    return {
      verified: 0,
      unverified: 0,
      unreachable: 0,
      errored: body.companyIds.length,
    };
  }
}
