import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import { insertCompany, insertLead, leads } from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { companyInput, leadInput } from "@mela/database/testing/fixtures";
import { createTestApp } from "../testing/app";

/**
 * API tests for GET /api/leads (task 2.4): filters, ordering and the
 * provenance field (scoredAt) the lead list views need.
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

const LOW_SCORES = {
  business_fit: 10,
  technical_opportunity: 10,
  business_opportunity: 10,
  decision_maker_found: 5,
  company_quality: 5,
} as const;

const VERY_HIGH_SCORES = {
  business_fit: 28,
  technical_opportunity: 28,
  business_opportunity: 19,
  decision_maker_found: 9,
  company_quality: 8,
} as const;

describe("GET /api/leads", () => {
  it("orders by score descending by default and carries the company context and recorded time", async () => {
    const lowCompany = await insertCompany(
      harness.database,
      companyInput({ name: "Low Score Co", industryId: "logistics" }),
    );
    const highCompany = await insertCompany(
      harness.database,
      companyInput({ name: "High Score Co", industryId: "logistics" }),
    );

    await insertLead(harness.database, leadInput(lowCompany.id, { scores: LOW_SCORES }));
    await insertLead(harness.database, leadInput(highCompany.id, { scores: VERY_HIGH_SCORES }));

    const response = await request(app?.getHttpServer()).get("/api/leads").expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body[0].companyName).toBe("High Score Co");
    expect(response.body[0].priority).toBe("very_high");
    expect(response.body[1].companyName).toBe("Low Score Co");
    expect(response.body[0].scoredAt).toBeTruthy();
  });

  it("orders ascending when order=score_asc", async () => {
    const lowCompany = await insertCompany(harness.database, companyInput({ name: "Low" }));
    const highCompany = await insertCompany(harness.database, companyInput({ name: "High" }));

    await insertLead(harness.database, leadInput(lowCompany.id, { scores: LOW_SCORES }));
    await insertLead(harness.database, leadInput(highCompany.id, { scores: VERY_HIGH_SCORES }));

    const response = await request(app?.getHttpServer())
      .get("/api/leads?order=score_asc")
      .expect(200);

    expect(response.body[0].companyName).toBe("Low");
    expect(response.body[1].companyName).toBe("High");
  });

  it("filters by minScore and maxScore", async () => {
    const lowCompany = await insertCompany(harness.database, companyInput({ name: "Low" }));
    const highCompany = await insertCompany(harness.database, companyInput({ name: "High" }));

    await insertLead(harness.database, leadInput(lowCompany.id, { scores: LOW_SCORES }));
    await insertLead(harness.database, leadInput(highCompany.id, { scores: VERY_HIGH_SCORES }));

    const response = await request(app?.getHttpServer())
      .get("/api/leads?minScore=80&maxScore=100")
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].companyName).toBe("High");
  });

  it("filters by priority and by industryId", async () => {
    const logisticsCo = await insertCompany(
      harness.database,
      companyInput({ name: "Logistics Co", industryId: "logistics" }),
    );
    const hospitalityCo = await insertCompany(
      harness.database,
      companyInput({ name: "Hospitality Co", industryId: "hospitality", cityId: "abu_dhabi" }),
    );

    await insertLead(harness.database, leadInput(logisticsCo.id, { scores: VERY_HIGH_SCORES }));
    await insertLead(harness.database, leadInput(hospitalityCo.id, { scores: VERY_HIGH_SCORES }));

    const byIndustry = await request(app?.getHttpServer())
      .get("/api/leads?industryId=hospitality")
      .expect(200);
    expect(byIndustry.body).toHaveLength(1);
    expect(byIndustry.body[0].companyName).toBe("Hospitality Co");

    const byPriority = await request(app?.getHttpServer())
      .get("/api/leads?priority=very_high")
      .expect(200);
    expect(byPriority.body).toHaveLength(2);

    const byMissingPriority = await request(app?.getHttpServer())
      .get("/api/leads?priority=low")
      .expect(200);
    expect(byMissingPriority.body).toHaveLength(0);
  });

  it("marks a lead scored past the staleness window as stale, and excludes it when stale=false", async () => {
    const company = await insertCompany(harness.database, companyInput({ name: "Stale Co" }));
    const lead = await insertLead(harness.database, leadInput(company.id, { scores: LOW_SCORES }));

    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await harness.database
      .update(leads)
      .set({ scoredAt: fortyDaysAgo })
      .where(eq(leads.id, lead.id));

    const staleOnly = await request(app?.getHttpServer()).get("/api/leads?stale=true").expect(200);
    expect(staleOnly.body).toHaveLength(1);
    expect(staleOnly.body[0].isStale).toBe(true);

    const freshOnly = await request(app?.getHttpServer()).get("/api/leads?stale=false").expect(200);
    expect(freshOnly.body).toHaveLength(0);
  });
});
