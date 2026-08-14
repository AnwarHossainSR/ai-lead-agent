import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  approveOutreach,
  insertAccount,
  insertCompany,
  insertLead,
  insertOutreachDraft,
  recordOutreachSend,
} from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { accountInput, companyInput, leadInput } from "@mela/database/testing/fixtures";
import { DATABASE } from "../database/database.module";
import { AnalyticsService } from "./analytics.service";

describe("analytics service", () => {
  let harness: TestDatabase;
  let service: AnalyticsService;

  beforeEach(async () => {
    harness = await setupTestDatabase();
    await harness.truncate();

    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DATABASE,
          useValue: harness.database,
        },
        AnalyticsService,
      ],
    }).compile();

    service = moduleRef.get(AnalyticsService);
  });

  afterEach(async () => {
    await harness.close();
  });

  it("returns empty aggregates when no outreach has been sent", async () => {
    const result = await service.getOutreachAggregates();

    expect(result).toEqual([]);
  });

  it("returns sent and responded counts by segment", async () => {
    const company = await insertCompany(harness.database, companyInput());
    const lead = await insertLead(harness.database, leadInput(company.id));
    const draft = await insertOutreachDraft(harness.database, {
      leadId: lead.id,
      channel: "email",
      messageBody: "Example draft.",
      isExample: false,
    });
    const actor = await insertAccount(harness.database, accountInput());
    const approved = await approveOutreach(harness.database, draft.id, actor.id);
    await recordOutreachSend(harness.database, {
      outreachId: draft.id,
      sentAt: new Date(approved.approvedAt!.getTime() + 1_000),
      means: "gmail",
      actorAccountId: actor.id,
    });

    const result = await service.getOutreachAggregates({ segment: "industry" });

    expect(result).toHaveLength(1);
    expect(result[0]!.segment).toBe("industry");
    expect(result[0]!.value).toBe(company.industryId);
    expect(result[0]!.sent).toBe(1);
    expect(result[0]!.responded).toBe(0);
    expect(result[0]!.unrecorded).toBe(1);
    expect(result[0]!.responseRate).toBe(0);
  });
});
