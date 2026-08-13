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

import { LEAD_PRIORITIES, LEAD_STATUSES, type LeadPriority, type LeadStatus } from "@mela/config";
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

// z.coerce.boolean() would treat the query string "false" as truthy — any
// non-empty string coerces to true — so the two accepted strings are
// matched explicitly instead.
const booleanQueryParam = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

const leadFiltersSchema = z.object({
  priority: z.enum(LEAD_PRIORITIES as [LeadPriority, ...LeadPriority[]]).optional(),
  status: z.enum(LEAD_STATUSES as [LeadStatus, ...LeadStatus[]]).optional(),
  industryId: z.string().min(1).optional(),
  cityId: z.string().min(1).optional(),
  serviceId: z.string().min(1).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  stale: booleanQueryParam,
  staleAfterDays: z.coerce.number().int().min(1).optional(),
  active: booleanQueryParam,
});

const listLeadsQuerySchema = leadFiltersSchema.extend({
  order: z.enum(["score_asc", "score_desc"]).default("score_desc"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

class ListLeadsQueryDto extends createZodDto(listLeadsQuerySchema) {}
class CountLeadsQueryDto extends createZodDto(leadFiltersSchema) {}

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
  async listLeads(@Query() query: ListLeadsQueryDto) {
    return this.scoringService.listLeads({
      priority: query.priority,
      status: query.status,
      industryId: query.industryId,
      cityId: query.cityId,
      serviceId: query.serviceId,
      minScore: query.minScore,
      maxScore: query.maxScore,
      stale: query.stale,
      staleAfterDays: query.staleAfterDays,
      active: query.active,
      order: query.order,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("leads/count")
  async countLeads(@Query() query: CountLeadsQueryDto) {
    const value = await this.scoringService.countLeads(query);
    return { count: value };
  }
}
