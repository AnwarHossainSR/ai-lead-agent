import { type Database, type DependencyHistory, readDependencyHistory } from "@mela/database";
import { Controller, Get, Inject, Query } from "@nestjs/common";
import { z } from "zod";

import { DATABASE } from "../database/database.module";
import { type InferDto, createZodDto } from "../validation/zod-dto";

const historyQuerySchema = z.object({
  windowMinutes: z.coerce
    .number()
    .int()
    .min(1)
    .max(60 * 24 * 30)
    .optional(),
  bucketMinutes: z.coerce
    .number()
    .int()
    .min(1)
    .max(60 * 24)
    .optional(),
});

const HistoryQueryDto = createZodDto(historyQuerySchema);
type HistoryQueryDto = InferDto<typeof HistoryQueryDto>;

/**
 * The sampled dependency history behind the uptime bar (design D6).
 *
 * A separate controller from the three liveness endpoints, and deliberately
 * **not** `@Public()`. Those three exist for a load balancer and say only
 * whether the process can serve traffic right now; a record of when each
 * dependency was down is operational detail, and it sits behind the same
 * sign-in as every other aggregate read.
 *
 * A period with no sample comes back with `status: null`. Nothing here fills a
 * gap from the samples on either side of it.
 */
@Controller("health")
export class HealthHistoryController {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  @Get("history")
  async history(@Query() query: HistoryQueryDto): Promise<readonly DependencyHistory[]> {
    return readDependencyHistory(this.database, {
      windowMinutes: query.windowMinutes,
      bucketMinutes: query.bucketMinutes,
    });
  }
}
