import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import {
  companies,
  insertAIInvocation,
  insertCompany,
  insertOpportunity,
  insertOpportunityAnalysisRun,
  insertWebsiteAnalysis,
} from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { aiInvocationInput, companyInput } from "@mela/database/testing/fixtures";
import { createTestApp } from "../testing/app";

/**
 * API tests for GET /api/companies (task 2.4): filters, ordering, the
 * discovery provenance fields, and that a failed/blocked analysis outcome
 * is visible rather than omitted (task 2.3).
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

describe("GET /api/companies", () => {
  it("orders by creation time descending by default and carries discovery provenance", async () => {
    const first = await insertCompany(
      harness.database,
      companyInput({
        name: "First Co",
        discoverySource: "google_places",
        discoverySourceUrl: "https://maps.example.com/first",
      }),
    );
    await insertCompany(harness.database, companyInput({ name: "Second Co" }));

    const response = await request(app?.getHttpServer()).get("/api/companies").expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body[0].name).toBe("Second Co");
    expect(response.body[1].name).toBe("First Co");
    expect(response.body[1].discoverySource).toBe("google_places");
    expect(response.body[1].discoverySourceUrl).toBe("https://maps.example.com/first");
    expect(response.body[1].id).toBe(first.id);
  });

  it("orders by name ascending when order=name_asc", async () => {
    await insertCompany(harness.database, companyInput({ name: "Zebra Co" }));
    await insertCompany(harness.database, companyInput({ name: "Alpha Co" }));

    const response = await request(app?.getHttpServer())
      .get("/api/companies?order=name_asc")
      .expect(200);

    expect(response.body[0].name).toBe("Alpha Co");
    expect(response.body[1].name).toBe("Zebra Co");
  });

  it("filters by verificationState, industryId and cityId", async () => {
    const verified = await insertCompany(
      harness.database,
      companyInput({ name: "Verified Co", industryId: "logistics", cityId: "dubai" }),
    );
    await harness.database
      .update(companies)
      .set({ verificationState: "verified" })
      .where(eq(companies.id, verified.id));

    await insertCompany(
      harness.database,
      companyInput({ name: "Unverified Co", industryId: "hospitality", cityId: "abu_dhabi" }),
    );

    const byState = await request(app?.getHttpServer())
      .get("/api/companies?verificationState=verified")
      .expect(200);
    expect(byState.body).toHaveLength(1);
    expect(byState.body[0].name).toBe("Verified Co");

    const byIndustry = await request(app?.getHttpServer())
      .get("/api/companies?industryId=hospitality")
      .expect(200);
    expect(byIndustry.body).toHaveLength(1);
    expect(byIndustry.body[0].name).toBe("Unverified Co");

    const byCity = await request(app?.getHttpServer())
      .get("/api/companies?cityId=dubai")
      .expect(200);
    expect(byCity.body).toHaveLength(1);
    expect(byCity.body[0].name).toBe("Verified Co");
  });

  it("shows a blocked analysis as blocked rather than omitting the company", async () => {
    const blocked = await insertCompany(harness.database, companyInput({ name: "Blocked Co" }));
    await insertWebsiteAnalysis(harness.database, {
      companyId: blocked.id,
      analysedUrl: "https://blocked.example.com",
      outcome: "blocked",
      failureReason: "Disallowed by robots.txt",
    });

    const neverAnalysed = await insertCompany(
      harness.database,
      companyInput({ name: "Never Analysed Co" }),
    );

    const response = await request(app?.getHttpServer()).get("/api/companies").expect(200);

    expect(response.body).toHaveLength(2);

    const blockedRow = response.body.find((row: { id: string }) => row.id === blocked.id);
    expect(blockedRow.latestAnalysis.outcome).toBe("blocked");
    expect(blockedRow.latestAnalysis.failureReason).toBe("Disallowed by robots.txt");

    const neverAnalysedRow = response.body.find(
      (row: { id: string }) => row.id === neverAnalysed.id,
    );
    expect(neverAnalysedRow.latestAnalysis).toBeNull();
  });
});

describe("GET /api/companies/:id/opportunities", () => {
  it("returns opportunities with their certainty and cited evidence", async () => {
    const company = await insertCompany(harness.database, companyInput({ name: "Opportunity Co" }));
    const invocation = await insertAIInvocation(harness.database, aiInvocationInput());
    const run = await insertOpportunityAnalysisRun(harness.database, {
      companyId: company.id,
      promptVersion: 1,
      outcome: "opportunities",
      acceptedCount: 1,
      aiInvocationId: invocation.id,
    });
    await insertOpportunity(harness.database, {
      analysisRunId: run.id,
      companyId: company.id,
      categoryId: "modernization",
      serviceId: "web_development",
      title: "Outdated stack",
      description: "The site runs a framework several major versions behind.",
      impact: "Slower delivery and a harder hiring story.",
      citedEvidence: ["observation-1"],
      aiInvocationId: invocation.id,
    });

    const response = await request(app?.getHttpServer())
      .get(`/api/companies/${company.id}/opportunities`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].certainty).toBe("inferred");
    expect(response.body[0].citedEvidence).toEqual(["observation-1"]);
    expect(response.body[0].createdAt).toBeTruthy();
  });

  it("returns an empty list rather than an error for a company with none", async () => {
    const company = await insertCompany(
      harness.database,
      companyInput({ name: "No Opportunity Co" }),
    );

    const response = await request(app?.getHttpServer())
      .get(`/api/companies/${company.id}/opportunities`)
      .expect(200);

    expect(response.body).toEqual([]);
  });
});

describe("GET /api/companies/count", () => {
  it("counts companies matching the same filters as the list endpoint", async () => {
    await insertCompany(
      harness.database,
      companyInput({ name: "Logistics Co", industryId: "logistics" }),
    );
    await insertCompany(
      harness.database,
      companyInput({ name: "Hospitality Co", industryId: "hospitality" }),
    );

    const total = await request(app?.getHttpServer()).get("/api/companies/count").expect(200);
    expect(total.body).toEqual({ count: 2 });

    const filtered = await request(app?.getHttpServer())
      .get("/api/companies/count?industryId=logistics")
      .expect(200);
    expect(filtered.body).toEqual({ count: 1 });
  });
});
