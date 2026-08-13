import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { classifyPriority } from "@mela/config/product/lead-priority";
import { getComponentRules } from "@mela/config/product/lead-scoring";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { companyInput } from "@mela/database/testing/fixtures";
import { insertAIInvocation } from "@mela/database/write/ai-invocations";
import { insertCompany } from "@mela/database/write/companies";
import { gatherCompanyEvidence } from "@mela/database/write/company-evidence";
import { insertWebsiteAnalysis } from "@mela/database/write/website-analysis";
import { composeScores } from "./composer";
import { formatExplanation } from "./formatter";
import { registerScorer } from "./scorer";
import { businessFitScorer } from "./scorers/business-fit.scorer";
import { contactReachabilityScorer } from "./scorers/contact-reachability.scorer";
import { opportunityStrengthScorer } from "./scorers/opportunity-strength.scorer";
import { technologyFitScorer } from "./scorers/technology-fit.scorer";
import { websiteQualityScorer } from "./scorers/website-quality.scorer";

registerScorer(websiteQualityScorer);
registerScorer(technologyFitScorer);
registerScorer(opportunityStrengthScorer);
registerScorer(contactReachabilityScorer);
registerScorer(businessFitScorer);

let harness: TestDatabase;
let companyId: string;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  const company = await insertCompany(harness.database, companyInput());
  companyId = company.id;

  await insertAIInvocation(harness.database, {
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
});

afterAll(async () => {
  await harness.close();
});

describe("composeScores", () => {
  it("returns a total derived only from the company profile when no other evidence exists", async () => {
    const company = await insertCompany(harness.database, {
      name: "Example Trading L.L.C.",
      countryId: "uae",
      cityId: "dubai",
      industryId: "logistics",
      companySize: "1000+",
      discoverySource: "test fixture",
      discoverySourceUrl: "https://example.com/fixture",
    });

    const evidence = await gatherCompanyEvidence(harness.database, company.id);
    const result = composeScores({ evidence, weightVersion: 1 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThan(100);
    expect(result.priority).toBe("low");
    expect(result.components).toHaveLength(5);

    const businessFit = result.components.find((c) => c.componentId === "company_quality");
    expect(businessFit?.value).toBeGreaterThan(0);
  });

  it("caps missing components at their unknown ceiling", async () => {
    await insertWebsiteAnalysis(harness.database, {
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

    const evidence = await gatherCompanyEvidence(harness.database, companyId);
    const result = composeScores({ evidence, weightVersion: 1 });

    const websiteComponent = result.components.find((c) => c.componentId === "business_fit");
    expect(websiteComponent?.value).toBeGreaterThan(0);

    const missingComponents = result.components.filter((c) => c.missing.length > 0);
    for (const component of missingComponents) {
      const rules = getComponentRules(component.componentId);
      expect(component.value).toBeLessThanOrEqual(rules.unknownCeiling);
    }
  });

  it("derives priority through classifyPriority", async () => {
    await insertWebsiteAnalysis(harness.database, {
      companyId,
      analysedUrl: "https://example.com",
      outcome: "completed",
      performanceScore: 100,
      accessibilityScore: 100,
      seoScore: 100,
      mobileScore: 100,
      uxScore: 100,
      technologyStack: [],
      observations: [],
      businessOpportunities: [],
    });

    const evidence = await gatherCompanyEvidence(harness.database, companyId);
    const result = composeScores({ evidence, weightVersion: 1 });

    expect(result.priority).toBe(classifyPriority(result.total));
  });
});

describe("boundary totals classify correctly", () => {
  const boundaries = [90, 89, 80, 79, 70, 69] as const;

  for (const total of boundaries) {
    it(`classifies ${total} as ${classifyPriority(total)}`, () => {
      expect(classifyPriority(total)).toBe(classifyPriority(total));
    });
  }
});

describe("formatExplanation", () => {
  it("produces deterministic output for identical evidence", async () => {
    await insertWebsiteAnalysis(harness.database, {
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

    const evidence = await gatherCompanyEvidence(harness.database, companyId);
    const result = composeScores({ evidence, weightVersion: 1 });
    const first = formatExplanation(result);

    const second = formatExplanation(result);

    expect(first.summary).toBe(second.summary);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("includes all component details in the formatted output", async () => {
    await insertWebsiteAnalysis(harness.database, {
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

    const evidence = await gatherCompanyEvidence(harness.database, companyId);
    const result = composeScores({ evidence, weightVersion: 1 });
    const explanation = formatExplanation(result);

    expect(explanation.components).toHaveLength(5);
    for (const component of explanation.components) {
      expect(component.label.length).toBeGreaterThan(0);
      expect(component.value).toBeGreaterThanOrEqual(0);
      expect(component.contribution).toBeGreaterThanOrEqual(0);
    }
  });
});
