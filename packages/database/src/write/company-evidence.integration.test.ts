import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { companyInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { insertAIInvocation } from "./ai-invocations";
import { insertCompany } from "./companies";
import {
  NoEvidenceForScoringError,
  assertEvidenceForScoring,
  gatherCompanyEvidence,
  identifyEvidence,
} from "./company-evidence";
import { insertContact } from "./contacts";
import { insertOpportunity } from "./opportunities";
import { insertOpportunityAnalysisRun } from "./opportunity-analysis-runs";
import { insertTechnologyDetection } from "./technology-detections";
import { insertWebsiteAnalysis } from "./website-analysis";

let harness: TestDatabase;
let companyId: string;
let aiInvocationId: string;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  const company = await insertCompany(harness.database, companyInput());
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

describe("gatherCompanyEvidence", () => {
  it("returns company attributes when no other evidence exists", async () => {
    const evidence = await gatherCompanyEvidence(harness.database, companyId);

    expect(evidence.companyId).toBe(companyId);
    expect(evidence.company.countryId).toBe("uae");
    expect(evidence.company.industryId).toBe("logistics");
    expect(evidence.analysis).toBeUndefined();
    expect(evidence.detections).toHaveLength(0);
    expect(evidence.opportunities).toHaveLength(0);
    expect(evidence.contacts).toHaveLength(0);
  });

  it("includes a completed website analysis and its detections", async () => {
    const analysis = await insertWebsiteAnalysis(harness.database, {
      companyId,
      analysedUrl: "https://example.com",
      outcome: "completed",
      performanceScore: 80,
      accessibilityScore: 70,
      seoScore: 60,
      mobileScore: 75,
      uxScore: 85,
      technologyStack: [],
      observations: [],
      businessOpportunities: [],
    });

    await insertTechnologyDetection(harness.database, {
      analysisId: analysis.id,
      fingerprintId: "fp-1",
      technologyId: "wordpress",
      category: "cms",
      certainty: "observed",
      matchedIn: "html",
      matchedText: "wp-content",
    });

    const evidence = await gatherCompanyEvidence(harness.database, companyId);

    expect(evidence.analysis?.id).toBe(analysis.id);
    expect(evidence.analysis?.performanceScore).toBe(80);
    expect(evidence.detections).toHaveLength(1);
    expect(evidence.detections[0]?.technologyId).toBe("wordpress");
  });

  it("includes current opportunities from the latest successful run", async () => {
    const analysis = await insertWebsiteAnalysis(harness.database, {
      companyId,
      analysedUrl: "https://example.com",
      outcome: "completed",
      performanceScore: 80,
      accessibilityScore: 70,
      seoScore: 60,
      mobileScore: 75,
      uxScore: 85,
      technologyStack: [],
      observations: [],
      businessOpportunities: [],
    });

    const run = await insertOpportunityAnalysisRun(harness.database, {
      companyId,
      websiteAnalysisId: analysis.id,
      promptVersion: 1,
      outcome: "opportunities",
      acceptedCount: 2,
      rejectedCount: 0,
      aiInvocationId: aiInvocationId,
    });

    await insertOpportunity(harness.database, {
      analysisRunId: run.id,
      companyId,
      categoryId: "website_modernization",
      serviceId: "website_modernization",
      title: "Upgrade stack",
      description: "Move to modern framework",
      impact: "Better performance",
      citedEvidence: ["evidence-1"],
      aiInvocationId,
    });

    const evidence = await gatherCompanyEvidence(harness.database, companyId);

    expect(evidence.opportunities).toHaveLength(1);
    expect(evidence.opportunities[0]?.title).toBe("Upgrade stack");
  });

  it("includes contacts", async () => {
    await insertContact(harness.database, {
      companyId,
      name: "Jane Doe",
      jobTitle: "CTO",
      certainty: "observed",
      extractionMethod: "deterministic",
      researchSource: "linkedin",
      sourceUrl: "https://linkedin.com/company/example",
    });

    const evidence = await gatherCompanyEvidence(harness.database, companyId);

    expect(evidence.contacts).toHaveLength(1);
    expect(evidence.contacts[0]?.name).toBe("Jane Doe");
  });

  it("produces stable identifiers that reflect the underlying rows", async () => {
    const analysis = await insertWebsiteAnalysis(harness.database, {
      companyId,
      analysedUrl: "https://example.com",
      outcome: "completed",
      performanceScore: 80,
      accessibilityScore: 70,
      seoScore: 60,
      mobileScore: 75,
      uxScore: 85,
      technologyStack: [],
      observations: [],
      businessOpportunities: [],
    });

    await insertTechnologyDetection(harness.database, {
      analysisId: analysis.id,
      fingerprintId: "fp-1",
      technologyId: "wordpress",
      category: "cms",
      certainty: "observed",
      matchedIn: "html",
      matchedText: "wp-content",
    });

    await insertContact(harness.database, {
      companyId,
      name: "Jane Doe",
      jobTitle: "CTO",
      certainty: "observed",
      extractionMethod: "deterministic",
      researchSource: "linkedin",
      sourceUrl: "https://linkedin.com/company/example",
    });

    const evidence = await gatherCompanyEvidence(harness.database, companyId);
    const ids = identifyEvidence(evidence);

    expect(ids.companyId).toBe(companyId);
    expect(ids.analysisId).toBe(analysis.id);
    expect(ids.analysisCreatedAt).toBe(analysis.createdAt.toISOString());
    expect(ids.detectionIds).toHaveLength(1);
    expect(ids.contactIds).toHaveLength(1);
    expect(ids.opportunityIds).toHaveLength(0);
  });

  it("returns an empty analysis when none is completed", async () => {
    await insertWebsiteAnalysis(harness.database, {
      companyId,
      analysedUrl: "https://example.com",
      outcome: "failed",
      failureReason: "timeout",
      performanceScore: null,
      accessibilityScore: null,
      seoScore: null,
      mobileScore: null,
      uxScore: null,
      technologyStack: [],
      observations: [],
      businessOpportunities: [],
    });

    const evidence = await gatherCompanyEvidence(harness.database, companyId);

    expect(evidence.analysis).toBeUndefined();
    expect(evidence.detections).toHaveLength(0);
  });
});

describe("assertEvidenceForScoring", () => {
  it("throws when no component has any input", async () => {
    const evidence = await gatherCompanyEvidence(harness.database, companyId);

    expect(() => assertEvidenceForScoring(evidence)).toThrow(NoEvidenceForScoringError);
    expect(() => assertEvidenceForScoring(evidence)).toThrow("Cannot score company");
  });

  it("passes when at least one piece of evidence exists", async () => {
    await insertContact(harness.database, {
      companyId,
      name: "Jane Doe",
      jobTitle: "CTO",
      certainty: "observed",
      extractionMethod: "deterministic",
      researchSource: "linkedin",
      sourceUrl: "https://linkedin.com/company/example",
    });

    const evidence = await gatherCompanyEvidence(harness.database, companyId);

    expect(() => assertEvidenceForScoring(evidence)).not.toThrow();
  });
});
