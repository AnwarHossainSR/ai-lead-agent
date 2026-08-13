import { Controller, Get, Query } from "@nestjs/common";

import type { AnalyticsQuery, AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("outreach")
  async getOutreachAggregates(@Query() query: AnalyticsQuery) {
    return this.analyticsService.getOutreachAggregates(query);
  }
}
