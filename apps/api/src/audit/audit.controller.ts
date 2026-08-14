import { type Database, listAuditEntries } from "@mela/database";
import { Controller, Get, Inject, Query, UsePipes, ValidationPipe } from "@nestjs/common";
import { z } from "zod";

import { RequiresRole } from "../auth/requires-role.decorator";
import { DATABASE } from "../database/database.module";
import { createZodDto } from "../validation/zod-dto";

const listAuditEntriesQuerySchema = z.object({
  event: z.string().trim().min(1).optional(),
  accountId: z.string().uuid().optional(),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

class ListAuditEntriesQueryDto extends createZodDto(listAuditEntriesQuerySchema) {}

/** Operator-only read access to the audit log (task 7.3). */
@Controller("audit-log")
export class AuditController {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  @Get()
  @RequiresRole("operator", "Viewing the audit log")
  @UsePipes(new ValidationPipe({ transform: true }))
  async listAuditEntries(@Query() query: ListAuditEntriesQueryDto) {
    return listAuditEntries(this.database, {
      event: query.event,
      accountId: query.accountId,
      since: query.since,
      until: query.until,
      limit: query.limit,
    });
  }
}
