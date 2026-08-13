import { Controller, Get, Query } from "@nestjs/common";

import { AnalyticsService } from "./analytics.service";
import { type AnalyticsQuery } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("outreach")
  async getOutreachAggregates(@Query() query: AnalyticsQuery) {
    return this.analyticsService.getOutreachAggregates(query);
  }
}
