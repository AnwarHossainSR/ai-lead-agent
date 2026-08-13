import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  insertAIInvocation,
  insertCompany,
  insertLead,
  insertLeadResearchSummary,
} from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { aiInvocationInput, companyInput, leadInput } from "@mela/database/testing/fixtures";
import { createTestApp } from "../testing/app";

/**
 * API tests for GET /api/leads/:id/research-summary (task 4.3): the shape
 * the lead detail's `<Generated>` panel reads, and what it gets when no
 * summary has been generated yet.
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

describe("GET /api/leads/:id/research-summary", () => {
  it("returns { summary: null } when no summary has been generated", async () => {
    const company = await insertCompany(harness.database, companyInput());
    const lead = await insertLead(harness.database, leadInput(company.id));

    const response = await request(app?.getHttpServer())
      .get(`/api/leads/${lead.id}/research-summary`)
      .expect(200);

    expect(response.body).toEqual({ summary: null });
  });

  it("returns the current summary's sections and unknown facts", async () => {
    const company = await insertCompany(harness.database, companyInput());
    const lead = await insertLead(harness.database, leadInput(company.id));
    const invocation = await insertAIInvocation(harness.database, aiInvocationInput());

    await insertLeadResearchSummary(harness.database, {
      leadId: lead.id,
      companyId: company.id,
      sections: {
        business: [{ text: "Runs a mid-size logistics operation in Dubai.", cites: ["o1"] }],
        webPresence: [],
        opportunities: [{ text: "Website has no online booking.", cites: ["o2"] }],
        people: [],
        approach: [{ text: "Lead with the booking-flow gap.", cites: ["o2"] }],
      },
      citedFacts: ["o1", "o2"],
      unknownFacts: ["Annual revenue", "Number of employees"],
      promptVersion: 1,
      aiInvocationId: invocation.id,
    });

    const response = await request(app?.getHttpServer())
      .get(`/api/leads/${lead.id}/research-summary`)
      .expect(200);

    expect(response.body.summary.sections.business).toEqual([
      { text: "Runs a mid-size logistics operation in Dubai.", cites: ["o1"] },
    ]);
    expect(response.body.summary.sections.opportunities[0].text).toBe(
      "Website has no online booking.",
    );
    expect(response.body.summary.unknownFacts).toEqual(["Annual revenue", "Number of employees"]);
  });
});
