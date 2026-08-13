import { describe, expect, it } from "vitest";

import type { CompanyEvidence } from "@mela/database";
import { businessFitScorer } from "./business-fit.scorer";
import { contactReachabilityScorer } from "./contact-reachability.scorer";
import { opportunityStrengthScorer } from "./opportunity-strength.scorer";
import { technologyFitScorer } from "./technology-fit.scorer";
import { websiteQualityScorer } from "./website-quality.scorer";

const SCORERS = [
  { scorer: websiteQualityScorer, name: "websiteQualityScorer" },
  { scorer: technologyFitScorer, name: "technologyFitScorer" },
  { scorer: opportunityStrengthScorer, name: "opportunityStrengthScorer" },
  { scorer: contactReachabilityScorer, name: "contactReachabilityScorer" },
  { scorer: businessFitScorer, name: "businessFitScorer" },
] as const;

describe("websiteQualityScorer", () => {
  const scorer = websiteQualityScorer;

  it("returns 0 and missing analysis when no analysis exists", () => {
    const evidence = makeEvidence({ analysis: undefined });
    const result = scorer.score(evidence);
    expect(result.value).toBe(0);
    expect(result.missing).toContain("website_analysis");
  });

  it("returns points from the matching threshold when scores are present", () => {
    const analysis = makeAnalysis({
      performanceScore: 80,
      accessibilityScore: 70,
      seoScore: 60,
      mobileScore: 75,
      uxScore: 85,
    });
    const evidence = makeEvidence({ analysis });
    const result = scorer.score(evidence);
    expect(result.value).toBeGreaterThan(0);
    expect(result.missing).not.toContain("lighthouse_scores");
  });

  it("records missing scores when some lighthouse scores are absent", () => {
    const analysis = makeAnalysis({
      performanceScore: 80,
      accessibilityScore: null,
      seoScore: null,
      mobileScore: null,
      uxScore: null,
    });
    const evidence = makeEvidence({ analysis });
    const result = scorer.score(evidence);
    expect(result.missing).toContain("accessibility_score");
    expect(result.missing).toContain("seo_score");
  });
});

describe("technologyFitScorer", () => {
  const scorer = technologyFitScorer;

  it("returns 0 and missing detections when no detections exist", () => {
    const evidence = makeEvidence({ detections: [] });
    const result = scorer.score(evidence);
    expect(result.value).toBe(0);
    expect(result.missing).toContain("technology_detections");
  });

  it("returns points based on matched configured technologies", () => {
    const detections = makeDetections([
      { technologyId: "wordpress", certainty: "observed" },
      { technologyId: "cloudflare", certainty: "inferred" },
    ]);
    const evidence = makeEvidence({ detections });
    const result = scorer.score(evidence);
    expect(result.value).toBeGreaterThan(0);
    expect(result.reasons[0]).toContain("2 of");
  });
});

describe("opportunityStrengthScorer", () => {
  const scorer = opportunityStrengthScorer;

  it("returns 0 and missing opportunities when none exist", () => {
    const evidence = makeEvidence({ opportunities: [] });
    const result = scorer.score(evidence);
    expect(result.value).toBe(0);
    expect(result.missing).toContain("opportunities");
  });

  it("returns higher points for more opportunities", () => {
    const opportunities1 = makeOpportunities(1);
    const opportunities3 = makeOpportunities(3);
    const result1 = scorer.score(makeEvidence({ opportunities: opportunities1 }));
    const result3 = scorer.score(makeEvidence({ opportunities: opportunities3 }));
    expect(result3.value).toBeGreaterThan(result1.value);
  });
});

describe("contactReachabilityScorer", () => {
  const scorer = contactReachabilityScorer;

  it("returns 0 and missing contacts when none exist", () => {
    const evidence = makeEvidence({ contacts: [] });
    const result = scorer.score(evidence);
    expect(result.value).toBe(0);
    expect(result.missing).toContain("contacts");
  });

  it("returns points based on contact count and seniority", () => {
    const contacts = makeContacts(2, "director", "receivable");
    const evidence = makeEvidence({ contacts });
    const result = scorer.score(evidence);
    expect(result.value).toBeGreaterThan(0);
  });
});

describe("businessFitScorer", () => {
  const scorer = businessFitScorer;

  it("returns 0 and missing profile when no company attributes exist", () => {
    const company = {
      id: "019fecbb-2222-7000-8000-000000000000",
      name: "Example Trading L.L.C.",
      normalizedName: "example trading l.l.c.",
      countryId: null,
      cityId: null,
      industryId: null,
      website: null,
      normalizedDomain: null,
      linkedinUrl: null,
      companySize: null,
      description: null,
      discoverySource: "test",
      discoverySourceUrl: "https://example.com",
      discoveryRunId: null,
      verificationState: "never_checked",
      verifiedAt: null,
      verificationRunId: null,
      isExample: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;
    const evidence = makeEvidence({ company });
    const result = scorer.score(evidence);
    expect(result.value).toBe(0);
    expect(result.missing).toContain("company_profile");
  });

  it("returns points based on target profile match", () => {
    const company = makeCompany({
      countryId: "uae",
      cityId: "dubai",
      industryId: "logistics",
      companySize: "51-200",
    });
    const evidence = makeEvidence({ company });
    const result = scorer.score(evidence);
    expect(result.value).toBeGreaterThan(0);
  });
});

describe("scorer purity", () => {
  for (const { scorer, name } of SCORERS) {
    it(`${name} does not call Date.now`, () => {
      const original = globalThis.Date.now;
      let called = false;
      globalThis.Date.now = () => {
        called = true;
        return original();
      };
      try {
        const evidence = makeEvidence({});
        scorer.score(evidence);
        expect(called).toBe(false);
      } finally {
        globalThis.Date.now = original;
      }
    });

    it(`${name} does not call Math.random`, () => {
      const original = globalThis.Math.random;
      let called = false;
      globalThis.Math.random = () => {
        called = true;
        return original();
      };
      try {
        const evidence = makeEvidence({});
        scorer.score(evidence);
        expect(called).toBe(false);
      } finally {
        globalThis.Math.random = original;
      }
    });
  }
});

function makeEvidence(overrides: Partial<CompanyEvidence> = {}): CompanyEvidence {
  return {
    companyId: "019fecbb-2222-7000-8000-000000000000",
    analysis: undefined,
    detections: [],
    opportunities: [],
    contacts: [],
    company: makeCompany(),
    ...overrides,
  } as CompanyEvidence;
}

function makeAnalysis(
  overrides: Partial<{
    performanceScore: number | null;
    accessibilityScore: number | null;
    seoScore: number | null;
    mobileScore: number | null;
    uxScore: number | null;
    observations: readonly { statement: string }[];
  }> = {},
): any {
  return {
    id: "019fecbb-1111-7000-8000-000000000000",
    companyId: "019fecbb-2222-7000-8000-000000000000",
    outcome: "completed",
    performanceScore: overrides.performanceScore ?? 80,
    accessibilityScore: overrides.accessibilityScore ?? 70,
    seoScore: overrides.seoScore ?? 60,
    mobileScore: overrides.mobileScore ?? 75,
    uxScore: overrides.uxScore ?? 85,
    observations: overrides.observations ?? [],
    ...overrides,
  };
}

function makeDetections(
  items: { technologyId: string; certainty: "observed" | "inferred" }[],
): readonly any[] {
  return items.map((item, index) => ({
    id: `019fecbb-${index}-7000-8000-000000000000`,
    analysisId: "019fecbb-1111-7000-8000-000000000000",
    companyId: "019fecbb-2222-7000-8000-000000000000",
    fingerprintId: `fp-${index}`,
    category: "cms",
    matchedIn: "html",
    matchedText: "test",
    createdAt: new Date(),
    ...item,
  }));
}

function makeOpportunities(count: number): readonly any[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `019fecbb-${index}-7000-8000-000000000000`,
    runId: "019fecbb-3333-7000-8000-000000000000",
    companyId: "019fecbb-2222-7000-8000-000000000000",
    categoryId: "website_modernization",
    serviceId: "website_modernization",
    title: `Opportunity ${index + 1}`,
    description: "Test description",
    impact: "Test impact",
    certainty: "inferred",
    citedEvidence: ["evidence-1"],
    aiInvocationId: "019fecbb-4444-7000-8000-000000000000",
    createdAt: new Date(),
  }));
}

function makeContacts(count: number, seniority: string, deliverability: string): readonly any[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `019fecbb-${index}-7000-8000-000000000000`,
    companyId: "019fecbb-2222-7000-8000-000000000000",
    name: `Contact ${index + 1}`,
    jobTitle: "CTO",
    linkedinUrl: null,
    email: null,
    phone: null,
    certainty: "observed",
    extractionMethod: "deterministic",
    seniorityId: seniority,
    roleSourceUrl: null,
    mailDeliverability: deliverability,
    aiInvocationId: null,
    researchSource: "linkedin",
    sourceUrl: "https://linkedin.com/company/example",
    isExample: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

function makeCompany(
  overrides: Partial<{
    countryId: string | undefined;
    cityId: string | undefined;
    industryId: string | undefined;
    companySize: string | undefined;
  }> = {},
): any {
  return {
    id: "019fecbb-2222-7000-8000-000000000000",
    name: "Example Trading L.L.C.",
    normalizedName: "example trading l.l.c.",
    countryId: overrides.countryId ?? "uae",
    cityId: overrides.cityId ?? "dubai",
    industryId: overrides.industryId ?? "logistics",
    website: "https://example.com",
    normalizedDomain: "example.com",
    linkedinUrl: null,
    companySize: overrides.companySize ?? "51-200",
    description: null,
    discoverySource: "test",
    discoverySourceUrl: "https://example.com",
    discoveryRunId: null,
    verificationState: "never_checked",
    verifiedAt: null,
    verificationRunId: null,
    isExample: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
