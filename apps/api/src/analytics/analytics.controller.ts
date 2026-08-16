import type { AnalyticsSeries } from "@mela/database";
import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";

import { type InferDto, createZodDto } from "../validation/zod-dto";
import { type AnalyticsQuery, AnalyticsService } from "./analytics.service";

const windowQuerySchema = z.object({
  // Bounded: a window of arbitrary length is a query nobody can plan for.
  windowDays: z.coerce.number().int().min(1).max(365).optional(),
});

const WindowQueryDto = createZodDto(windowQuerySchema);
type WindowQueryDto = InferDto<typeof WindowQueryDto>;

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("outreach")
  async getOutreachAggregates(@Query() query: AnalyticsQuery) {
    return this.analyticsService.getOutreachAggregates(query);
  }

  @Get("discovery")
  async getDiscoverySeries(@Query() query: WindowQueryDto): Promise<AnalyticsSeries> {
    return this.analyticsService.getDiscoverySeries(query.windowDays);
  }

  @Get("scores")
  async getScoreSeries(@Query() query: WindowQueryDto): Promise<AnalyticsSeries> {
    return this.analyticsService.getScoreSeries(query.windowDays);
  }

  @Get("conversion")
  async getConversionSeries(@Query() query: WindowQueryDto): Promise<AnalyticsSeries> {
    return this.analyticsService.getConversionSeries(query.windowDays);
  }

  @Get("spend")
  async getSpendSeries(@Query() query: WindowQueryDto): Promise<AnalyticsSeries> {
    return this.analyticsService.getSpendSeries(query.windowDays);
  }
}
