import { Test } from "@nestjs/testing";
import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { companyInput, leadInput } from "@mela/database/testing/fixtures";
import { insertCompany, insertLead, insertOutreachDraft } from "@mela/database";
import { DATABASE } from "../database/database.module";
import { OutreachDraftingService } from "./outreach-drafting.service";
import { createTestApp } from "../testing/app";

describe("POST /api/outreach/:id/sent", () => {
  let harness: TestDatabase;
  let app: INestApplication | undefined;
  let service: OutreachDraftingService;
  let outreachId: string;

  beforeAll(async () => {
    harness = await setupTestDatabase();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  afterAll(async () => {
    await harness?.close();
  });

  beforeEach(async () => {
    await harness.truncate();

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
    await service.approveOutreach(outreachId);

    app = await createTestApp();
  });

  it("records a send for an approved outreach", async () => {
    const response = await request(app!.getHttpServer())
      .post(`/api/outreach/${outreachId}/sent`)
      .send({
        sentAt: new Date().toISOString(),
        means: "gmail",
      })
      .expect(200);

    expect(response.body.status).toBe("sent");
    expect(response.body.sentMeans).toBe("gmail");
    expect(response.body.sentAt).toBeDefined();
  });

  it("refuses a send for an unapproved outreach", async () => {
    const unapproved = await insertOutreachDraft(harness.database, {
      leadId: (await insertLead(harness.database, leadInput((await insertCompany(harness.database, companyInput())).id))).id,
      channel: "email",
      messageBody: "Unapproved draft.",
      isExample: false,
    });

    const response = await request(app!.getHttpServer())
      .post(`/api/outreach/${unapproved.id}/sent`)
      .send({
        sentAt: new Date().toISOString(),
        means: "gmail",
      })
      .expect(400);

    expect(response.body.message).toContain("sending is reachable only from approved");
  });

  it("refuses a backdated send", async () => {
    const approved = await service.approveOutreach(outreachId);
    const backdate = new Date(approved.approvedAt!.getTime() - 60_000);

    const response = await request(app!.getHttpServer())
      .post(`/api/outreach/${outreachId}/sent`)
      .send({
        sentAt: backdate.toISOString(),
        means: "gmail",
      })
      .expect(400);

    expect(response.body.message).toContain("earlier than approval time");
  });
});
