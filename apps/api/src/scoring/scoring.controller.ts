import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import { type LeadPriority } from "@mela/config";
import { z } from "zod";
import { createZodDto } from "../validation/zod-dto";
import { ScoringService } from "./scoring.service";

const scoreCompanySchema = z.object({
  weightVersion: z.number().int().min(1),
});

const batchScoreSchema = z.object({
  companyIds: z.array(z.string().uuid()).min(1).max(100),
  weightVersion: z.number().int().min(1),
});

class ScoreCompanyRequestDto extends createZodDto(scoreCompanySchema) {}
class BatchScoreRequestDto extends createZodDto(batchScoreSchema) {}

@Controller()
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Post("companies/:id/score")
  @UsePipes(new ValidationPipe({ transform: true }))
  async scoreCompany(@Param("id") companyId: string, @Body() body: ScoreCompanyRequestDto) {
    return this.scoringService.scoreCompany({
      companyId,
      weightVersion: body.weightVersion,
    });
  }

  @Post("scoring/batch")
  @HttpCode(202)
  @UsePipes(new ValidationPipe({ transform: true }))
  async batchScore(@Body() body: BatchScoreRequestDto) {
    return this.scoringService.batchScore({
      companyIds: body.companyIds,
      weightVersion: body.weightVersion,
    });
  }

  @Get("leads/:id/score")
  async getLeadScore(@Param("id") leadId: string) {
    const history = await this.scoringService.getScoreHistory(leadId);
    const latest = history[history.length - 1];
    if (latest === undefined) {
      return null;
    }
    return {
      ...latest.snapshot,
      diff: latest.diff ?? null,
    };
  }

  @Get("leads/:id/score/history")
  async getScoreHistory(@Param("id") leadId: string) {
    return this.scoringService.getScoreHistory(leadId);
  }

  @Get("leads")
  async listLeads(
    @Query("priority") priority?: string,
    @Query("minScore") minScore?: string,
    @Query("maxScore") maxScore?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.scoringService.listLeads({
      priority: priority as LeadPriority | undefined,
      minScore: minScore !== undefined ? Number(minScore) : undefined,
      maxScore: maxScore !== undefined ? Number(maxScore) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
      offset: offset !== undefined ? Number(offset) : undefined,
    });
  }
}
