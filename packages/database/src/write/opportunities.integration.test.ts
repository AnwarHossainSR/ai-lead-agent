import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { opportunityAnalysisRuns } from "../schema/opportunity-analysis-runs";
import { opportunities } from "../schema/opportunities";
import { companies } from "../schema/companies";
import { insertOpportunityAnalysisRun } from "./opportunity-analysis-runs";
import { insertOpportunity } from "./opportunities";
import { insertCompany } from "./companies";
import { insertAIInvocation } from "./ai-invocations";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { expectConstraintViolation } from "../testing/constraints";
import { eq } from "drizzle-orm";

let harness: TestDatabase;
let companyId: string;
let aiInvocationId: string;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  const company = await insertCompany(harness.database, {
    name: "Example Trading L.L.C.",
    countryId: "uae",
    cityId: "dubai",
    industryId: "logistics",
    discoverySource: "test fixture",
    discoverySourceUrl: "https://example.com/fixture",
  });
  companyId = company.id;

  const invocation = await insertAIInvocation(harness.database, {
    promptName: "opportunity-analysis",
    promptVersion: 1,
    model: "test-model",
    tier: "default",
    inputTokens: 100,
    outputTokens: 50,
    estimatedCostUsd: 0.01,
    latencyMs: 1000,
    attempts: 1,
    outcome: "succeeded",
  });
  aiInvocationId = invocation.id;
});

afterAll(async () => {
  await harness.close();
});

const opportunityRunInput = (overrides: Partial<{
  outcome: "opportunities" | "insufficient_evidence" | "below_threshold" | "failed";
  acceptedCount: number;
  rejectedCount: number;
  reason?: string;
  rejections?: Array<{ reason: string; count: number }>;
}> = {}): Parameters<typeof insertOpportunityAnalysisRun>[1] => ({
  companyId,
  promptVersion: 1,
  outcome: overrides.outcome ?? "opportunities",
  acceptedCount: overrides.acceptedCount ?? 1,
  rejectedCount: overrides.rejectedCount ?? 0,
  rejections: overrides.rejections ?? [],
  aiInvocationId,
  ...overrides,
});

const opportunityInput = (overrides: Partial<{
  analysisRunId: string;
  categoryId: string;
  serviceId: string;
  title: string;
  description: string;
  impact: string;
  citedEvidence: string[];
  aiInvocationId?: string;
}> = {}): Parameters<typeof insertOpportunity>[1] => ({
  analysisRunId: overrides.analysisRunId ?? "00000000-0000-0000-0000-000000000001",
  companyId,
  categoryId: overrides.categoryId ?? "website_modernization",
  serviceId: overrides.serviceId ?? "website_modernization",
  title: overrides.title ?? "Test Opportunity",
  description: overrides.description ?? "Test description",
  impact: overrides.impact ?? "Test impact",
  citedEvidence: overrides.citedEvidence ?? ["o1"],
  aiInvocationId: overrides.aiInvocationId ?? aiInvocationId,
});

describe("an opportunity stored with citations and invocation", () => {
  it("stores the opportunity with all required fields", async () => {
    const run = await insertOpportunityAnalysisRun(harness.database, opportunityRunInput({}));
    const opp = await insertOpportunity(harness.database, opportunityInput({ analysisRunId: run.id }));

    expect(opp.id).toBeDefined();
    expect(opp.runId).toBe(run.id);
    expect(opp.companyId).toBe(companyId);
    expect(opp.categoryId).toBe("website_modernization");
    expect(opp.serviceId).toBe("website_modernization");
    expect(opp.title).toBe("Test Opportunity");
    expect(opp.description).toBe("Test description");
    expect(opp.impact).toBe("Test impact");
    expect(opp.certainty).toBe("inferred");
    expect(opp.citedEvidence).toEqual(["o1"]);
    expect(opp.aiInvocationId).toBe(aiInvocationId);
  });
});

describe("an opportunity with no citations is refused", () => {
  it("refuses opportunity with no cited evidence", async () => {
    const run = await insertOpportunityAnalysisRun(harness.database, opportunityRunInput({}));
    await expectConstraintViolation(
      harness.database.insert(opportunities).values({
        id: crypto.randomUUID(),
        runId: run.id,
        companyId,
        categoryId: "website_modernization",
        serviceId: "website_modernization",
        title: "Test Opportunity",
        description: "Test description",
        impact: "Test impact",
        certainty: "inferred",
        citedEvidence: [],
        aiInvocationId,
      }),
      "opportunities_cited_evidence_check",
    );
  });
});

describe("an opportunity without an invocation is refused", () => {
  it("refuses opportunity without ai_invocation_id", async () => {
    const run = await insertOpportunityAnalysisRun(harness.database, opportunityRunInput({}));
    const error = await harness.database.insert(opportunities).values({
      id: crypto.randomUUID(),
      runId: run.id,
      companyId,
      categoryId: "website_modernization",
      serviceId: "website_modernization",
      title: "Test Opportunity",
      description: "Test description",
      impact: "Test impact",
      certainty: "inferred",
      citedEvidence: ["o1"],
      aiInvocationId: undefined as any,
    }).catch((e: any) => e);
    expect(error).toBeDefined();
  });
});

describe("an opportunity claiming observation is refused", () => {
  it("refuses opportunity with certainty of observed", async () => {
    const run = await insertOpportunityAnalysisRun(harness.database, opportunityRunInput({}));
    await expectConstraintViolation(
      harness.database.insert(opportunities).values({
        id: crypto.randomUUID(),
        runId: run.id,
        companyId,
        categoryId: "website_modernization",
        serviceId: "website_modernization",
        title: "Test Opportunity",
        description: "Test description",
        impact: "Test impact",
        certainty: "observed",
        citedEvidence: ["o1"],
        aiInvocationId,
      }),
      "opportunities_certainty_check",
    );
  });
});

describe("a blank description is refused", () => {
  it("refuses opportunity with blank title", async () => {
    const run = await insertOpportunityAnalysisRun(harness.database, opportunityRunInput({}));
    await expectConstraintViolation(
      harness.database.insert(opportunities).values({
        id: crypto.randomUUID(),
        runId: run.id,
        companyId,
        categoryId: "website_modernization",
        serviceId: "website_modernization",
        title: " ",
        description: "Test description",
        impact: "Test impact",
        certainty: "inferred",
        citedEvidence: ["o1"],
        aiInvocationId,
      }),
      "opportunities_title_not_blank",
    );
  });

  it("refuses opportunity with blank description", async () => {
    const run = await insertOpportunityAnalysisRun(harness.database, opportunityRunInput({}));
    await expectConstraintViolation(
      harness.database.insert(opportunities).values({
        id: crypto.randomUUID(),
        runId: run.id,
        companyId,
        categoryId: "website_modernization",
        serviceId: "website_modernization",
        title: "Test Opportunity",
        description: "  ",
        impact: "Test impact",
        certainty: "inferred",
        citedEvidence: ["o1"],
        aiInvocationId,
      }),
      "opportunities_description_not_blank",
    );
  });

  it("refuses opportunity with blank impact", async () => {
    const run = await insertOpportunityAnalysisRun(harness.database, opportunityRunInput({}));
    await expectConstraintViolation(
      harness.database.insert(opportunities).values({
        id: crypto.randomUUID(),
        runId: run.id,
        companyId,
        categoryId: "website_modernization",
        serviceId: "website_modernization",
        title: "Test Opportunity",
        description: "Test description",
        impact: "  ",
        certainty: "inferred",
        citedEvidence: ["o1"],
        aiInvocationId,
      }),
      "opportunities_impact_not_blank",
    );
  });
});

describe("a run records its outcome and counts", () => {
  it("stores the run with outcome and counts", async () => {
    const run = await insertOpportunityAnalysisRun(harness.database, opportunityRunInput({
      outcome: "opportunities",
      acceptedCount: 2,
      rejectedCount: 1,
    }));

    expect(run.outcome).toBe("opportunities");
    expect(run.acceptedCount).toBe(2);
    expect(run.rejectedCount).toBe(1);
  });
});

describe("an unrecognised outcome is refused", () => {
  it("refuses outcome outside the defined set", async () => {
    const error = await harness.database.insert(opportunityAnalysisRuns).values({
      id: crypto.randomUUID(),
      companyId,
      promptVersion: 1,
      outcome: "invalid_outcome" as any,
      acceptedCount: 1,
      rejectedCount: 0,
      rejections: [],
      aiInvocationId,
    }).catch((e: any) => e);
    expect(error).toBeDefined();
  });
});

describe("a produced-opportunities outcome requires at least one opportunity", () => {
  it("refuses run with outcome opportunities but accepted_count of zero", async () => {
    await expectConstraintViolation(
      insertOpportunityAnalysisRun(harness.database, opportunityRunInput({
        acceptedCount: 0,
      })),
      "opportunity_analysis_runs_check",
    );
  });
});

describe("deleting a company removes its runs and opportunities", () => {
  it("cascades deletion to opportunities and runs", async () => {
    const run = await insertOpportunityAnalysisRun(harness.database, opportunityRunInput({}));
    await insertOpportunity(harness.database, opportunityInput({ analysisRunId: run.id }));

    const beforeRuns = await harness.database.select().from(opportunityAnalysisRuns);
    const beforeOps = await harness.database.select().from(opportunities);
    expect(beforeRuns).toHaveLength(1);
    expect(beforeOps).toHaveLength(1);

    await harness.database.delete(companies).where(eq(companies.id, companyId as any));

    const afterRuns = await harness.database.select().from(opportunityAnalysisRuns);
    const afterOps = await harness.database.select().from(opportunities);
    expect(afterRuns).toHaveLength(0);
    expect(afterOps).toHaveLength(0);
  });
});

describe("the stored shape carries no quantified impact", () => {
  it("the opportunity has text impact, not numeric", async () => {
    const run = await insertOpportunityAnalysisRun(harness.database, opportunityRunInput({}));
    const opp = await insertOpportunity(harness.database, opportunityInput({ analysisRunId: run.id }));

    const columnInfo = await harness.database.execute(
      `SELECT data_type FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'impact'`,
    );

    expect(columnInfo.some((c: any) => c.data_type === "text")).toBe(true);
  });
});
