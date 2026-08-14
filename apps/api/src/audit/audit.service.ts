import { type Database, insertAuditEntry } from "@mela/database";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { DATABASE } from "../database/database.module";

export interface AuditRecordInput {
  readonly accountId?: string | null;
  readonly event: string;
  readonly outcome: "succeeded" | "failed";
  readonly subjectType?: string;
  readonly subjectId?: string;
  readonly sourceAddress?: string;
  readonly detail?: Record<string, unknown>;
}

/**
 * The one place `apps/api` writes to the audit log (design D6, task 7.1).
 *
 * `detail` is free-form JSON stored as-is, so every caller is responsible
 * for keeping it to non-sensitive facts — never a password, a hash, a
 * session id or a model prompt/response, per the requirement this exists to
 * satisfy (task 7.2).
 *
 * Failing to write an audit entry never fails the request it describes: the
 * action already happened (or was refused) by the time this runs, and an
 * audit outage should not become an outage of the product itself. The
 * failure is logged instead.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      await insertAuditEntry(this.database, {
        accountId: input.accountId ?? null,
        event: input.event,
        outcome: input.outcome,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        sourceAddress: input.sourceAddress,
        detail: input.detail ?? {},
      });
    } catch (error) {
      this.logger.error(`Failed to write audit entry for event "${input.event}".`, error);
    }
  }
}
