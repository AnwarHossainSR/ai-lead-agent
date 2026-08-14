import type { ActivityEntry, AttentionItem, DashboardSummary, FunnelStage } from "@mela/database";
import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";

import { type InferDto, createZodDto } from "../validation/zod-dto";
import { DashboardService } from "./dashboard.service";

const summaryQuerySchema = z.object({
  // Bounded so a request cannot ask the database to bucket four years by day.
  windowDays: z.coerce.number().int().min(1).max(90).optional(),
});

const SummaryQueryDto = createZodDto(summaryQuerySchema);
type SummaryQueryDto = InferDto<typeof SummaryQueryDto>;

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const ActivityQueryDto = createZodDto(activityQuerySchema);
type ActivityQueryDto = InferDto<typeof ActivityQueryDto>;

/**
 * The dashboard's reads. Every route here is a read, and none carries
 * `@RequiresRole` — a viewer sees the workspace (spec: aggregate reads do not
 * require an operator). They are still guarded: the global guard denies by
 * default, so an unauthenticated request is refused before it reaches a count.
 */
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  async getSummary(@Query() query: SummaryQueryDto): Promise<DashboardSummary> {
    return this.dashboardService.getSummary(query.windowDays);
  }

  @Get("funnel")
  async getFunnel(): Promise<readonly FunnelStage[]> {
    return this.dashboardService.getFunnel();
  }

  @Get("activity")
  async getActivity(@Query() query: ActivityQueryDto): Promise<readonly ActivityEntry[]> {
    return this.dashboardService.getActivity(query.limit);
  }

  @Get("attention")
  async getAttention(): Promise<readonly AttentionItem[]> {
    return this.dashboardService.getAttention();
  }
}
