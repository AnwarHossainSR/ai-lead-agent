import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { leadResearchSummaries } from "../schema/lead-research-summaries";
import { expectConstraintViolation } from "../testing/constraints";
import { companyInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { insertAIInvocation } from "./ai-invocations";
import { insertCompany } from "./companies";
import {
  getCurrentLeadResearchSummary,
  getLeadResearchSummaryHistory,
  insertLeadResearchSummary,
} from "./lead-research-summaries";
import { insertLead } from "./leads";

let harness: TestDatabase;
let companyId: string;
let leadId: string;
let aiInvocationId: string;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  const company = await insertCompany(harness.database, companyInput());
  companyId = company.id;

  const lead = await insertLead(harness.database, {
    companyId,
    scores: {
      business_fit: 25,
      technical_opportunity: 25,
      business_opportunity: 15,
      decision_maker_found: 10,
      company_quality: 8,
    },
    scoreExplanation: "Example explanation for a test fixture.",
  });
  leadId = lead.id;

  const aiInvocation = await insertAIInvocation(harness.database, {
    promptName: "test_prompt",
    promptVersion: 1,
    model: "gemini-2.5-pro",
    tier: "default",
    inputTokens: 100,
    outputTokens: 50,
    estimatedCostUsd: 0.001,
    latencyMs: 250,
    attempts: 1,
    outcome: "succeeded",
  });
  aiInvocationId = aiInvocation.id;
});

afterAll(async () => {
  await harness.close();
});

describe("insertLeadResearchSummary", () => {
  it("stores a summary and returns it", async () => {
    const row = await insertLeadResearchSummary(harness.database, {
      leadId,
      companyId,
      sections: {
        business: [
          {
            text: "Operates in logistics across the UAE.",
            cites: ["c1"],
          },
        ],
      },
      citedFacts: ["c1"],
      unknownFacts: [],
      rejections: [],
      promptVersion: 1,
      aiInvocationId,
    });

    expect(row.leadId).toBe(leadId);
    expect(row.companyId).toBe(companyId);
    expect(row.promptVersion).toBe(1);
    expect(row.isGenerated).toBe("true");
  });

  it("refuses a summary with no cited facts", async () => {
    await expect(
      insertLeadResearchSummary(harness.database, {
        leadId,
        companyId,
        sections: {
          business: [
            {
              text: "Operates in logistics.",
              cites: ["c1"],
            },
          ],
        },
        citedFacts: [],
        unknownFacts: [],
        rejections: [],
        promptVersion: 1,
        aiInvocationId,
      }),
    ).rejects.toThrow(/citedFacts/);
  });

  it("is refused by the database when is_generated is false", async () => {
    await expectConstraintViolation(
      harness.database.insert(leadResearchSummaries).values({
        id: "019fecbb-2222-7000-8000-000000000000",
        leadId,
        companyId,
        sections: { business: [] },
        citedFacts: ["c1"],
        unknownFacts: [],
        rejections: [],
        promptVersion: 1,
        aiInvocationId,
        isGenerated: "false",
        createdAt: new Date(),
      }),
      "lead_research_summaries_is_generated",
    );
  });

  it("is refused by the database when cited_facts is empty", async () => {
    await expectConstraintViolation(
      harness.database.insert(leadResearchSummaries).values({
        id: "019fecbb-2222-7000-8000-000000000000",
        leadId,
        companyId,
        sections: { business: [] },
        citedFacts: [],
        unknownFacts: [],
        rejections: [],
        promptVersion: 1,
        aiInvocationId,
        isGenerated: "true",
        createdAt: new Date(),
      }),
      "lead_research_summaries_cited_facts_non_empty",
    );
  });
});

describe("getCurrentLeadResearchSummary", () => {
  it("returns the most recent summary", async () => {
    await insertLeadResearchSummary(harness.database, {
      leadId,
      companyId,
      sections: { business: [{ text: "First", cites: ["c1"] }] },
      citedFacts: ["c1"],
      promptVersion: 1,
      aiInvocationId,
    });

    await insertLeadResearchSummary(harness.database, {
      leadId,
      companyId,
      sections: { business: [{ text: "Second", cites: ["c2"] }] },
      citedFacts: ["c2"],
      promptVersion: 1,
      aiInvocationId,
    });

    const current = await getCurrentLeadResearchSummary(harness.database, leadId);
    expect(current?.sections.business?.[0]?.text).toBe("Second");
  });

  it("returns undefined when no summary exists", async () => {
    const current = await getCurrentLeadResearchSummary(harness.database, leadId);
    expect(current).toBeUndefined();
  });
});

describe("getLeadResearchSummaryHistory", () => {
  it("returns summaries ordered by created_at desc", async () => {
    await insertLeadResearchSummary(harness.database, {
      leadId,
      companyId,
      sections: { business: [{ text: "First", cites: ["c1"] }] },
      citedFacts: ["c1"],
      promptVersion: 1,
      aiInvocationId,
    });

    await insertLeadResearchSummary(harness.database, {
      leadId,
      companyId,
      sections: { business: [{ text: "Second", cites: ["c2"] }] },
      citedFacts: ["c2"],
      promptVersion: 1,
      aiInvocationId,
    });

    const history = await getLeadResearchSummaryHistory(harness.database, leadId);
    expect(history).toHaveLength(2);
    expect(history[0]?.sections.business?.[0]?.text).toBe("Second");
    expect(history[1]?.sections.business?.[0]?.text).toBe("First");
  });
});
