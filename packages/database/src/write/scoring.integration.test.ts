import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { leads } from "../schema/leads";
import { leadScoreSnapshots } from "../schema/score-snapshots";
import { expectConstraintViolation } from "../testing/constraints";
import { companyInput, leadInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { insertCompany } from "./companies";
import { insertLead } from "./leads";
import {
  compareSnapshots,
  insertLeadScoreSnapshot,
  listStaleLeads,
  updateLeadScore,
} from "./scoring";

let harness: TestDatabase;
let companyId: string;
let leadId: string;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  const company = await insertCompany(harness.database, companyInput());
  companyId = company.id;
  const lead = await insertLead(harness.database, leadInput(companyId));
  leadId = lead.id;
});

afterAll(async () => {
  await harness.close();
});

describe("lead score snapshots", () => {
  it("inserts directly with raw sql to verify constraint", async () => {
    const constraints = await harness.database.execute(
      sql`SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid = 'lead_score_snapshots'::regclass AND contype = 'c'`,
    );
    console.log("CONSTRAINTS:", JSON.stringify(constraints, null, 2));

    await harness.database.execute(
      sql`INSERT INTO lead_score_snapshots (lead_id, company_id, website_quality_score, technology_fit_score, opportunity_score, contact_score, business_fit_score, total_score, priority, explanation, weight_version, evidence_refs, missing) VALUES (${leadId}, ${companyId}, 25, 25, 15, 10, 10, 85, 'high', 'Snapshot explanation.', 1, '{"analysisId":"test"}', '[]')`,
    );

    const [snapshot] = await harness.database
      .select()
      .from(leadScoreSnapshots)
      .where(eq(leadScoreSnapshots.leadId, leadId));

    expect(snapshot).toBeDefined();
    expect(snapshot!.totalScore).toBe(85);
    expect(snapshot!.priority).toBe("high");
    expect(snapshot!.weightVersion).toBe(1);
  });

  it("stores a snapshot with consistent total", async () => {
    await insertLeadScoreSnapshot(harness.database, {
      leadId,
      companyId,
      scores: {
        business_fit: 25,
        technical_opportunity: 25,
        business_opportunity: 15,
        decision_maker_found: 10,
        company_quality: 10,
      },
      total: 85,
      priority: "high",
      explanation: "Snapshot explanation.",
      weightVersion: 1,
      evidenceRefs: '{"analysisId":"test"}',
      missing: "[]",
    });

    const [snapshot] = await harness.database
      .select()
      .from(leadScoreSnapshots)
      .where(eq(leadScoreSnapshots.leadId, leadId));

    expect(snapshot).toBeDefined();
    expect(snapshot!.totalScore).toBe(85);
    expect(snapshot!.priority).toBe("high");
    expect(snapshot!.weightVersion).toBe(1);
  });

  it("is refused when the total does not match the weighted components", async () => {
    await expect(
      harness.database.insert(leadScoreSnapshots).values({
        leadId,
        companyId,
        websiteQualityScore: 25,
        technologyFitScore: 25,
        opportunityScore: 15,
        contactScore: 10,
        businessFitScore: 10,
        totalScore: 999,
        priority: "high",
        explanation: "Inconsistent snapshot.",
        weightVersion: 1,
        evidenceRefs: "{}",
        missing: "[]",
      }),
    ).rejects.toThrow();

    const snapshots = await harness.database.select().from(leadScoreSnapshots);
    expect(snapshots).toHaveLength(0);
  });

  it("is refused when the explanation is blank", async () => {
    await expect(
      harness.database.insert(leadScoreSnapshots).values({
        leadId,
        companyId,
        websiteQualityScore: 25,
        technologyFitScore: 25,
        opportunityScore: 15,
        contactScore: 10,
        businessFitScore: 10,
        totalScore: 85,
        priority: "high",
        explanation: "   ",
        weightVersion: 1,
        evidenceRefs: "{}",
        missing: "[]",
      }),
    ).rejects.toThrow();

    await expectConstraintViolation(
      harness.database.insert(leadScoreSnapshots).values({
        leadId,
        companyId,
        websiteQualityScore: 25,
        technologyFitScore: 25,
        opportunityScore: 15,
        contactScore: 10,
        businessFitScore: 10,
        totalScore: 85,
        priority: "high",
        explanation: "   ",
        weightVersion: 1,
        evidenceRefs: "{}",
        missing: "[]",
      }),
      "lead_score_snapshots_explanation_not_blank",
    );
  });

  it("accumulates snapshots when rescoring", async () => {
    await insertLeadScoreSnapshot(harness.database, {
      leadId,
      companyId,
      scores: {
        business_fit: 25,
        technical_opportunity: 25,
        business_opportunity: 15,
        decision_maker_found: 10,
        company_quality: 10,
      },
      total: 85,
      priority: "high",
      explanation: "First snapshot.",
      weightVersion: 1,
      evidenceRefs: "{}",
      missing: "[]",
    });

    await insertLeadScoreSnapshot(harness.database, {
      leadId,
      companyId,
      scores: {
        business_fit: 30,
        technical_opportunity: 30,
        business_opportunity: 20,
        decision_maker_found: 10,
        company_quality: 10,
      },
      total: 100,
      priority: "very_high",
      explanation: "Second snapshot.",
      weightVersion: 1,
      evidenceRefs: "{}",
      missing: "[]",
    });

    const snapshots = await harness.database.select().from(leadScoreSnapshots);
    expect(snapshots).toHaveLength(2);
  });

  it("deletes snapshots when the lead is deleted", async () => {
    await insertLeadScoreSnapshot(harness.database, {
      leadId,
      companyId,
      scores: {
        business_fit: 25,
        technical_opportunity: 25,
        business_opportunity: 15,
        decision_maker_found: 10,
        company_quality: 10,
      },
      total: 85,
      priority: "high",
      explanation: "Snapshot.",
      weightVersion: 1,
      evidenceRefs: "{}",
      missing: "[]",
    });

    await harness.database.delete(leads).where(eq(leads.id, leadId));

    const snapshots = await harness.database.select().from(leadScoreSnapshots);
    expect(snapshots).toHaveLength(0);
  });
});

describe("updateLeadScore", () => {
  it("writes only the score columns, weight version and scored time", async () => {
    await updateLeadScore(harness.database, {
      leadId,
      scores: {
        business_fit: 30,
        technical_opportunity: 30,
        business_opportunity: 20,
        decision_maker_found: 10,
        company_quality: 10,
      },
      explanation: "Updated explanation.",
      weightVersion: 1,
      evidenceRefs: "{}",
      missing: "[]",
    });

    const [updated] = await harness.database.select().from(leads).where(eq(leads.id, leadId));
    expect(updated?.businessFitScore).toBe(30);
    expect(updated?.technicalOpportunityScore).toBe(30);
    expect(updated?.businessOpportunityScore).toBe(20);
    expect(updated?.decisionMakerFoundScore).toBe(10);
    expect(updated?.companyQualityScore).toBe(10);
    expect(updated?.leadScore).toBe(100);
    expect(updated?.scoreExplanation).toBe("Updated explanation.");
    expect(updated?.weightVersion).toBe(1);
    expect(updated?.scoredAt).toBeDefined();
    expect(updated?.status).toBe("discovered");
  });

  it("refuses a write that carries a status", async () => {
    await expect(
      updateLeadScore(harness.database, {
        leadId,
        scores: {
          business_fit: 30,
          technical_opportunity: 30,
          business_opportunity: 20,
          decision_maker_found: 10,
          company_quality: 10,
        },
        explanation: "Updated explanation.",
        weightVersion: 1,
        evidenceRefs: "{}",
        missing: "[]",
        status: "qualified",
      } as any),
    ).rejects.toThrow();
  });
});

describe("listStaleLeads", () => {
  it("returns leads whose weight version is older than the current one", async () => {
    await harness.database
      .update(leads)
      .set({ weightVersion: 1, scoredAt: new Date() })
      .where(eq(leads.id, leadId));

    const stale = await listStaleLeads(harness.database, 2);
    expect(stale).toHaveLength(1);
    expect(stale[0]?.id).toBe(leadId);
  });

  it("returns no leads when all are current", async () => {
    await harness.database
      .update(leads)
      .set({ weightVersion: 2, scoredAt: new Date() })
      .where(eq(leads.id, leadId));

    const stale = await listStaleLeads(harness.database, 2);
    expect(stale).toHaveLength(0);
  });
});

describe("compareSnapshots", () => {
  it("reports the components that changed between two snapshots", async () => {
    const older = {
      id: "019fecbb-1111-7000-8000-000000000000",
      leadId,
      companyId,
      websiteQualityScore: 25,
      technologyFitScore: 25,
      opportunityScore: 15,
      contactScore: 10,
      businessFitScore: 10,
      totalScore: 85,
      priority: "high",
      explanation: "Old explanation.",
      weightVersion: 1,
      evidenceRefs: "{}",
      missing: "[]",
      createdAt: new Date(),
    };

    const newer = {
      ...older,
      id: "019fecbb-2222-7000-8000-000000000000",
      websiteQualityScore: 30,
      technologyFitScore: 25,
      opportunityScore: 15,
      contactScore: 10,
      businessFitScore: 10,
      totalScore: 90,
      priority: "high",
      explanation: "New explanation.",
      createdAt: new Date(),
    };

    const diff = compareSnapshots(older, newer);
    expect(diff.changedComponents).toEqual(["website_quality"]);
  });
});
