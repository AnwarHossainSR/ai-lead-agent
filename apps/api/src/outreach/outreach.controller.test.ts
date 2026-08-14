import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { insertAccount, insertCompany, insertLead, insertOutreachDraft } from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { accountInput, companyInput, leadInput } from "@mela/database/testing/fixtures";
import { DATABASE } from "../database/database.module";
import { OutreachDraftingService } from "./outreach-drafting.service";

describe("recordOutreachSent", () => {
  let harness: TestDatabase;
  let service: OutreachDraftingService;
  let outreachId: string;
  let actorAccountId: string;

  beforeEach(async () => {
    harness = await setupTestDatabase();

    const actor = await insertAccount(harness.database, accountInput());
    actorAccountId = actor.id;

    const company = await insertCompany(harness.database, companyInput());
    const lead = await insertLead(harness.database, leadInput(company.id));
    const draft = await insertOutreachDraft(harness.database, {
      leadId: lead.id,
      channel: "email",
      messageBody: "Example draft.",
      isExample: false,
    });

    outreachId = draft.id;

    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DATABASE,
          useValue: harness.database,
        },
        {
          provide: "AI_SERVICE",
          useValue: { run: vi.fn() },
        },
        OutreachDraftingService,
      ],
    }).compile();

    service = moduleRef.get(OutreachDraftingService);
    await service.approveOutreach(outreachId, actorAccountId);
  });

  afterEach(async () => {
    await harness.close();
  });

  it("records a send for an approved outreach", async () => {
    const approvedAt = new Date(Date.now() + 1_000);
    const sent = await service.recordOutreachSent(
      outreachId,
      {
        sentAt: approvedAt,
        means: "gmail",
      },
      actorAccountId,
    );

    expect(sent.status).toBe("sent");
    expect(sent.sentMeans).toBe("gmail");
    expect(sent.sentAt).toBeInstanceOf(Date);
  });

  it("refuses a send for an unapproved outreach", async () => {
    const unapproved = await insertOutreachDraft(harness.database, {
      leadId: (
        await insertLead(
          harness.database,
          leadInput((await insertCompany(harness.database, companyInput())).id),
        )
      ).id,
      channel: "email",
      messageBody: "Unapproved draft.",
      isExample: false,
    });

    await expect(
      service.recordOutreachSent(
        unapproved.id,
        {
          sentAt: new Date(),
          means: "gmail",
        },
        actorAccountId,
      ),
    ).rejects.toThrow("sending is reachable only from approved");
  });

  it("refuses a backdated send", async () => {
    const backdate = new Date("2020-01-01T00:00:00.000Z");

    await expect(
      service.recordOutreachSent(
        outreachId,
        {
          sentAt: backdate,
          means: "gmail",
        },
        actorAccountId,
      ),
    ).rejects.toThrow("earlier than approval time");
  });
});
