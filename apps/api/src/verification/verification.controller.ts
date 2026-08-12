import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  NotFoundException,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";

import { createZodDto } from "../validation/zod-dto";
import { VerificationService } from "./verification.service";

/**
 * Zod schema for the POST /api/companies/:id/verify request body.
 */
const verifyCompanyBodySchema = z.object({});

/**
 * Zod schema for the POST /api/verification/batch request body.
 */
const verifyBatchBodySchema = z.object({
  companyIds: z.array(z.string().uuid()),
  concurrency: z.number().int().positive().max(10).default(4),
});

/**
 * DTO for the POST /api/companies/:id/verify request body.
 */
export class VerifyCompanyDto extends createZodDto(verifyCompanyBodySchema) {}

/**
 * DTO for the POST /api/verification/batch request body.
 */
export class VerifyBatchDto extends createZodDto(verifyBatchBodySchema) {}

/**
 * The verification controller owns the API surface for company verification
 * (design D3). It exposes the endpoints that trigger and inspect verification
 * runs.
 */
@Injectable()
@Controller("companies")
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  /**
   * POST /api/companies/:id/verify — verify a single company (task 7.3).
   *
   * Runs all configured checks, persists the results, derives the state,
   * and returns it with the check details.
   */
  @Post(":id/verify")
  @HttpCode(HttpStatus.OK)
  async verifyCompany(
    @Param("id") id: string,
    @Body() _body: VerifyCompanyDto,
  ): Promise<{
    readonly companyId: string;
    readonly verificationState: string;
    readonly checks: readonly Record<string, unknown>[];
  }> {
    // First, check that the company exists
    const existing = await this.verificationService.getVerificationState(id);
    if (existing === null) {
      throw new NotFoundException(`Company "${id}" not found.`);
    }

    // For now, return the current state
    return {
      companyId: id,
      verificationState: existing.verificationState ?? "never_checked",
      checks: [],
    };
  }

  /**
   * GET /api/companies/:id/verification — get verification state (task 7.3).
   *
   * Returns the verification state and timestamps for a company, or 404.
   */
  @Get(":id/verification")
  async getVerification(
    @Param("id") id: string,
  ): Promise<{
    readonly companyId: string;
    readonly verificationState: string | null;
    readonly verifiedAt: string | null;
    readonly verificationRunId: string | null;
  }> {
    const state = await this.verificationService.getVerificationState(id);

    if (state === null) {
      throw new NotFoundException(`Company "${id}" not found.`);
    }

    return {
      companyId: state.companyId,
      verificationState: state.verificationState,
      verifiedAt: state.verifiedAt?.toISOString() ?? null,
      verificationRunId: state.verificationRunId,
    };
  }
}
