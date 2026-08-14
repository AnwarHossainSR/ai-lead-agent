import type { INestApplication } from "@nestjs/common";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import {
  companies,
  insertAIInvocation,
  insertCompany,
  insertLead,
  insertOpportunity,
  insertOpportunityAnalysisRun,
  insertTechnologyDetection,
  insertWebsiteAnalysis,
} from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { aiInvocationInput, companyInput, leadInput } from "@mela/database/testing/fixtures";
import { createTestApp } from "../testing/app";
import { authedRequest } from "../testing/authed-request";
import { createAuthenticatedContext } from "../testing/authenticated-context";

/**
 * API tests for GET /api/companies (task 2.4): filters, ordering, the
 * discovery provenance fields, and that a failed/blocked analysis outcome
 * is visible rather than omitted (task 2.3).
 */

let harness: TestDatabase;
let app: INestApplication | undefined;
let authCookie: string;

/** Every route requires a session now (task 4.1); this attaches one to every call below without touching each call site. */
function request(server: Parameters<typeof authedRequest>[0]) {
  return authedRequest(server, authCookie);
}

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  app = await createTestApp({ DATABASE_URL: harness.url });
  authCookie = (await createAuthenticatedContext(harness.database)).cookie;
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

describe("GET /api/companies/:id", () => {
  it("returns the company with a null lead when it has not been scored", async () => {
    const company = await insertCompany(harness.database, companyInput({ name: "Solo Co" }));

    const response = await request(app?.getHttpServer())
      .get(`/api/companies/${company.id}`)
      .expect(200);

    expect(response.body.id).toBe(company.id);
    expect(response.body.name).toBe("Solo Co");
    expect(response.body.lead).toBeNull();
  });

  it("includes the lead summary when the company has been scored", async () => {
    const company = await insertCompany(harness.database, companyInput({ name: "Scored Co" }));
    const lead = await insertLead(harness.database, leadInput(company.id));

    const response = await request(app?.getHttpServer())
      .get(`/api/companies/${company.id}`)
      .expect(200);

    expect(response.body.lead).toEqual({
      id: lead.id,
      status: lead.status,
      priority: lead.priority,
      leadScore: lead.leadScore,
    });
  });

  it("returns 404 for a company that does not exist", async () => {
    await request(app?.getHttpServer())
      .get("/api/companies/00000000-0000-0000-0000-000000000000")
      .expect(404);
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

  it("resolves cited evidence refs to the observation and detection they point at", async () => {
    const company = await insertCompany(harness.database, companyInput({ name: "Evidence Co" }));
    const invocation = await insertAIInvocation(harness.database, aiInvocationInput());

    const analysis = await insertWebsiteAnalysis(harness.database, {
      companyId: company.id,
      analysedUrl: "https://evidence.example.com",
      observations: [
        {
          statement: "The homepage has no mobile navigation menu.",
          evidence: {
            detail: "No hamburger menu or nav element found at viewport width 375px.",
            url: "https://evidence.example.com/",
            observedAt: "2026-01-01T00:00:00Z",
          },
          certainty: "observed",
        },
      ],
    });

    await insertTechnologyDetection(harness.database, {
      analysisId: analysis.id,
      fingerprintId: "wordpress",
      technologyId: "wordpress",
      category: "cms",
      certainty: "observed",
      matchedIn: "html",
      matchedText: '<meta name="generator" content="WordPress 5.2">',
    });

    const run = await insertOpportunityAnalysisRun(harness.database, {
      companyId: company.id,
      websiteAnalysisId: analysis.id,
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
      title: "No mobile navigation",
      description: "Visitors on a phone cannot reach the site's navigation.",
      impact: "Mobile visitors bounce before finding what they came for.",
      citedEvidence: ["o1", "t1", "unresolvable-ref"],
      aiInvocationId: invocation.id,
    });

    const response = await request(app?.getHttpServer())
      .get(`/api/companies/${company.id}/opportunities`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    const resolved = response.body[0].resolvedEvidence;

    expect(resolved).toEqual([
      {
        ref: "o1",
        detail: "No hamburger menu or nav element found at viewport width 375px.",
        url: "https://evidence.example.com/",
      },
      {
        ref: "t1",
        detail: 'wordpress: "<meta name="generator" content="WordPress 5.2">"',
        url: "https://evidence.example.com",
      },
      {
        ref: "unresolvable-ref",
        detail: "This citation could not be resolved to its source.",
        url: null,
      },
    ]);
  });
});

describe("GET /api/companies/needs-attention", () => {
  it("collects blocked, failed and unreachable companies into their own buckets", async () => {
    const blocked = await insertCompany(harness.database, companyInput({ name: "Blocked Co" }));
    await insertWebsiteAnalysis(harness.database, {
      companyId: blocked.id,
      analysedUrl: "https://blocked.example.com",
      outcome: "blocked",
      failureReason: "Disallowed by robots.txt",
    });

    const failed = await insertCompany(harness.database, companyInput({ name: "Failed Co" }));
    await insertWebsiteAnalysis(harness.database, {
      companyId: failed.id,
      analysedUrl: "https://failed.example.com",
      outcome: "failed",
      failureReason: "Browser render timed out.",
    });

    const unreachable = await insertCompany(
      harness.database,
      companyInput({ name: "Unreachable Co" }),
    );
    await harness.database
      .update(companies)
      .set({ verificationState: "unreachable" })
      .where(eq(companies.id, unreachable.id));

    const healthy = await insertCompany(harness.database, companyInput({ name: "Healthy Co" }));
    await harness.database
      .update(companies)
      .set({ verificationState: "verified" })
      .where(eq(companies.id, healthy.id));
    await insertWebsiteAnalysis(harness.database, {
      companyId: healthy.id,
      analysedUrl: "https://healthy.example.com",
      outcome: "completed",
    });

    const response = await request(app?.getHttpServer())
      .get("/api/companies/needs-attention")
      .expect(200);

    expect(response.body.blocked).toHaveLength(1);
    expect(response.body.blocked[0].companyId).toBe(blocked.id);
    expect(response.body.blocked[0].reason).toBe("Disallowed by robots.txt");

    expect(response.body.failed).toHaveLength(1);
    expect(response.body.failed[0].companyId).toBe(failed.id);
    expect(response.body.failed[0].reason).toBe("Browser render timed out.");

    expect(response.body.unreachable).toHaveLength(1);
    expect(response.body.unreachable[0].companyId).toBe(unreachable.id);
    expect(response.body.unreachable[0].reason).toBeNull();

    const allIds = [
      ...response.body.blocked,
      ...response.body.failed,
      ...response.body.unreachable,
    ].map((record: { companyId: string }) => record.companyId);
    expect(allIds).not.toContain(healthy.id);
  });

  it("returns empty buckets rather than an error when nothing needs attention", async () => {
    await insertCompany(harness.database, companyInput({ name: "Fine Co" }));

    const response = await request(app?.getHttpServer())
      .get("/api/companies/needs-attention")
      .expect(200);

    expect(response.body).toEqual({ blocked: [], failed: [], unreachable: [] });
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
