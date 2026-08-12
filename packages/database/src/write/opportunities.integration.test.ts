import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { uuidv7 } from "uuidv7";

import { opportunityAnalysisRuns } from "../schema/opportunity-analysis-runs";
import { opportunities } from "../schema/opportunities";
import { companies } from "../schema/companies";
import { insertOpportunityAnalysisRun } from "./opportunity-analysis-runs";
import { insertOpportunity } from "./opportunities";
import { insertCompany } from "./companies";
import { setupTestDatabase, testDatabase } from "../testing/harness";
import { expectConstraintViolation } from "../testing/constraints";
import { eq } from "drizzle-orm";

let harness: testDatabase;
let companyId: string;
let aiInvocationId: string;

beforeAll(async () => {
  harness = await setupTestDatabase();
  
  // Ensure the opportunity analysis tables exist by running migration if needed
  // The harness applies migrations in setupTestDatabase, but let's verify
  const tables = await harness.database.execute(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  
  const tableNames = (tables as any[]).map((t: any) => t.table_name);
  
  if (!tableNames.includes("opportunity_analysis_runs")) {
    // Manual migration: create the tables
    await harness.database.execute(`
      CREATE TYPE "public"."opportunity_run_outcome" AS ENUM('opportunities', 'insufficient_evidence', 'below_threshold', 'failed');
      CREATE TABLE "opportunity_analysis_runs" (
        "id" uuid PRIMARY KEY NOT NULL,
        "company_id" uuid NOT NULL,
        "website_analysis_id" uuid,
        "prompt_version" integer NOT NULL,
        "outcome" "opportunity_run_outcome" NOT NULL,
        "accepted_count" integer DEFAULT 0 NOT NULL,
        "rejected_count" integer DEFAULT 0 NOT NULL,
        "rejections" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "ai_invocation_id" uuid,
        "reason" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
      ALTER TABLE "opportunity_analysis_runs" ADD CONSTRAINT "opportunity_analysis_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
      ALTER TABLE "opportunity_analysis_runs" ADD CONSTRAINT "opportunity_analysis_runs_website_analysis_id_website_analysis_id_fk" FOREIGN KEY ("website_analysis_id") REFERENCES "public"."website_analysis"("id") ON DELETE set null ON UPDATE no action;
      ALTER TABLE "opportunity_analysis_runs" ADD CONSTRAINT "opportunity_analysis_runs_ai_invocation_id_ai_invocations_id_fk" FOREIGN KEY ("ai_invocation_id") REFERENCES "public"."ai_invocations"("id") ON DELETE set null ON UPDATE no action;
      CREATE INDEX "opportunity_analysis_runs_company_id_idx" ON "opportunity_analysis_runs" USING btree ("company_id");
      CREATE INDEX "opportunity_analysis_runs_outcome_idx" ON "opportunity_analysis_runs" USING btree ("outcome");
    `);
  }
  
  if (!tableNames.includes("opportunities")) {
    await harness.database.execute(`
      CREATE TABLE "opportunities" (
        "id" uuid PRIMARY KEY NOT NULL,
        "run_id" uuid NOT NULL,
        "company_id" uuid NOT NULL,
        "category_id" text NOT NULL,
        "service_id" text NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "impact" text NOT NULL,
        "certainty" "certainty" NOT NULL DEFAULT 'inferred',
        "cited_evidence" jsonb NOT NULL,
        "ai_invocation_id" uuid NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
      ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_run_id_opportunity_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."opportunity_analysis_runs"("id") ON DELETE cascade ON UPDATE no action;
      ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
      ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_cited_evidence_check" CHECK (jsonb_array_length(cited_evidence) > 0);
      ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_title_not_blank" CHECK (length(btrim("title")) > 0);
      ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_description_not_blank" CHECK (length(btrim("description")) > 0);
      ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_impact_not_blank" CHECK (length(btrim("impact")) > 0);
      ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;
      CREATE INDEX "opportunities_company_id_idx" ON "opportunities" USING btree ("company_id");
      CREATE INDEX "opportunities_category_id_idx" ON "opportunities" USING btree ("category_id");
    `);
  }
  
  aiInvocationId = uuidv7();
});

afterAll(async () => {
  await harness.close();
});

const opportunityRunInput = (overrides: Partial<{
  outcome: "opportunities" | "insufficient_evidence" | "below_threshold" | "failed";
  acceptedCount: number;
  rejectedCount: number;
  reason?: string;
}> = {}): Parameters<typeof insertOpportunityAnalysisRun>[1] => ({
  companyId,
  promptVersion: 1,
  outcome: overrides.outcome ?? "opportunities",
  acceptedCount: overrides.acceptedCount ?? 1,
  rejectedCount: overrides.rejectedCount ?? 0,
  rejections: overrides.reasons ?? [],
  aiInvocationId,
  ...overrides,
});

const opportunityInput = (overrides: Partial<{
  categoryId: string;
  serviceId: string;
  title: string;
  description: string;
  impact: string;
  certainty: "observed" | "inferred";
  citedEvidence: string[];
  aiInvocationId?: string;
}> = {}): Parameters<typeof insertOpportunity>[1] => ({
  analysisRunId: "00000000-0000-0000-0000-000000000001",
  companyId,
  categoryId: overrides.categoryId ?? "website_modernization",
  serviceId: overrides.serviceId ?? "website_modernization",
  title: overrides.title ?? "Test Opportunity",
  description: overrides.description ?? "Test description",
  impact: overrides.impact ?? "Test impact",
  certainty: overrides.certainty ?? "inferred",
  citedEvidence: overrides.citedEvidence ?? ["o1"],
  aiInvocationId: overrides.aiInvocationId ?? aiInvocationId,
});

describe("an opportunity stored with citations and invocation", () => {
  it("stores the opportunity with all required fields", async () => {
    const run = await insertOpportunityAnalysisRun(harness.database, opportunityRunInput({}));
    const opp = await insertOpportunity(harness.database, opportunityInput({}));

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
    await expectConstraintViolation(
      insertOpportunity(harness.database, {
        ...opportunityInput({ citedEvidence: [] }),
        aiInvocationId,
      }),
      "opportunities_cited_evidence_check",
    );
  });
});

describe("an opportunity without an invocation is refused", () => {
  it("refuses opportunity without ai_invocation_id", async () => {
    await expectConstraintViolation(
      insertOpportunity(harness.database, {
        ...opportunityInput({ aiInvocationId: undefined as any }),
      }),
      "opportunities_ai_invocation_id_not_null",
    );
  });
});

describe("an opportunity claiming observation is refused", () => {
  it("refuses opportunity with certainty of observed", async () => {
    await expectConstraintViolation(
      insertOpportunity(harness.database, {
        ...opportunityInput({ certainty: "observed" }),
      }),
      "opportunities_certainty_check",
    );
  });
});

describe("a blank description is refused", () => {
  it("refuses opportunity with blank title", async () => {
    await expectConstraintViolation(
      insertOpportunity(harness.database, {
        ...opportunityInput({ title: " " }),
      }),
      "opportunities_title_not_blank",
    );
  });

  it("refuses opportunity with blank description", async () => {
    await expectConstraintViolation(
      insertOpportunity(harness.database, {
        ...opportunityInput({ description: "  " }),
      }),
      "opportunities_description_not_blank",
    );
  });

  it("refuses opportunity with blank impact", async () => {
    await expectConstraintViolation(
      insertOpportunity(harness.database, {
        ...opportunityInput({ impact: "  " }),
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
    await expectConstraintViolation(
      insertOpportunityAnalysisRun(harness.database, opportunityRunInput({
        outcome: "invalid_outcome" as any,
      })),
      "opportunity_analysis_runs_outcome_check",
    );
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
    await insertOpportunity(harness.database, opportunityInput({}));

    // Verify they exist
    const beforeRuns = await harness.database.select().from(opportunityAnalysisRuns);
    const beforeOps = await harness.database.select().from(opportunities);
    expect(beforeRuns).toHaveLength(1);
    expect(beforeOps).toHaveLength(1);

    // Delete the company
    await harness.database.delete(companies).where(eq(companies.id, companyId as any));

    // Verify they're gone
    const afterRuns = await harness.database.select().from(opportunityAnalysisRuns);
    const afterOps = await harness.database.select().from(opportunities);
    expect(afterRuns).toHaveLength(0);
    expect(afterOps).toHaveLength(0);
  });
});

describe("the stored shape carries no quantified impact", () => {
  it("the opportunity has text impact, not numeric", async () => {
    const run = await insertOpportunityAnalysisRun(harness.database, opportunityRunInput({}));
    const opp = await insertOpportunity(harness.database, opportunityInput({}));

    // Verify impact is stored as text by checking the schema
    const columnInfo = await harness.database.execute(
      `SELECT data_type FROM information_schema.columns WHERE table_name = 'opportunities' AND column_name = 'impact'`,
    );

    expect(columnInfo).toContain("varchar");
  });
});