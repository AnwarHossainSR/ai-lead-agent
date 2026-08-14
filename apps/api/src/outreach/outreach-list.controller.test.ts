import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  approveOutreach,
  insertCompany,
  insertLead,
  insertOutreachDraft,
  recordOutreachSend,
  submitOutreachForApproval,
} from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { companyInput, leadInput } from "@mela/database/testing/fixtures";
import { createTestApp } from "../testing/app";

/**
 * API tests for GET /api/outreach (task 2.4): the status filter, ordering,
 * and pagination added alongside the other read endpoints.
 */

let harness: TestDatabase;
let app: INestApplication | undefined;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  app = await createTestApp({ DATABASE_URL: harness.url });
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

afterAll(async () => {
  await harness?.close();
});

async function draftFor(leadId: string, messageBody: string) {
  return insertOutreachDraft(harness.database, {
    leadId,
    channel: "email",
    messageBody,
    isExample: false,
  });
}

describe("GET /api/outreach", () => {
  it("orders newest first and carries the cited facts", async () => {
    const company = await insertCompany(harness.database, companyInput());
    const lead = await insertLead(harness.database, leadInput(company.id));

    const first = await draftFor(lead.id, "First draft.");
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await draftFor(lead.id, "Second draft.");

    const response = await request(app?.getHttpServer()).get("/api/outreach").expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body[0].id).toBe(second.id);
    expect(response.body[1].id).toBe(first.id);
    expect(response.body[0]).toHaveProperty("citedFacts");
  });

  it("filters by status, including a non-draft status rather than omitting it", async () => {
    const company = await insertCompany(harness.database, companyInput());
    const lead = await insertLead(harness.database, leadInput(company.id));

    const draft = await draftFor(lead.id, "Still a draft.");
    const submitted = await draftFor(lead.id, "Ready for review.");
    await submitOutreachForApproval(harness.database, submitted.id);

    const drafts = await request(app?.getHttpServer())
      .get("/api/outreach?status=draft")
      .expect(200);
    expect(drafts.body).toHaveLength(1);
    expect(drafts.body[0].id).toBe(draft.id);

    const pending = await request(app?.getHttpServer())
      .get("/api/outreach?status=pending_approval")
      .expect(200);
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0].id).toBe(submitted.id);
  });

  it("paginates with limit and offset", async () => {
    const company = await insertCompany(harness.database, companyInput());
    const lead = await insertLead(harness.database, leadInput(company.id));

    await draftFor(lead.id, "Draft one.");
    await draftFor(lead.id, "Draft two.");
    await draftFor(lead.id, "Draft three.");

    const page = await request(app?.getHttpServer())
      .get("/api/outreach?limit=2&offset=1")
      .expect(200);

    expect(page.body).toHaveLength(2);
  });
});

describe("GET /api/outreach/count", () => {
  it("counts by status, and by sentAfter for a 'sent this week' style query", async () => {
    const company = await insertCompany(harness.database, companyInput());
    const lead = await insertLead(harness.database, leadInput(company.id));

    const toSend = await draftFor(lead.id, "Will be sent.");
    await submitOutreachForApproval(harness.database, toSend.id);
    await approveOutreach(harness.database, toSend.id);

    // sentAt must not precede the approval timestamp the server just
    // stamped, so it is set slightly in the future rather than backdated.
    const sentAt = new Date(Date.now() + 1_000);
    await recordOutreachSend(harness.database, { outreachId: toSend.id, sentAt, means: "gmail" });

    await draftFor(lead.id, "Still a draft.");

    const totalSent = await request(app?.getHttpServer())
      .get("/api/outreach/count?status=sent")
      .expect(200);
    expect(totalSent.body).toEqual({ count: 1 });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const sentSinceAnHourAgo = await request(app?.getHttpServer())
      .get(`/api/outreach/count?status=sent&sentAfter=${oneHourAgo}`)
      .expect(200);
    expect(sentSinceAnHourAgo.body).toEqual({ count: 1 });

    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const sentSinceAnHourFromNow = await request(app?.getHttpServer())
      .get(`/api/outreach/count?status=sent&sentAfter=${oneHourFromNow}`)
      .expect(200);
    expect(sentSinceAnHourFromNow.body).toEqual({ count: 0 });

    const drafts = await request(app?.getHttpServer())
      .get("/api/outreach/count?status=draft")
      .expect(200);
    expect(drafts.body).toEqual({ count: 1 });
  });
});
