import { describe, expect, it } from "vitest";

import { screenResearchSummaryOutput } from "./grounding";
import { assembleResearchSummaryInput } from "./input";
import { deriveUnknownFacts } from "./unknowns";

describe("research-summary helpers", () => {
  it("screens prohibited claims from output", () => {
    const input = {
      observations: [],
      detections: [],
      opportunities: [],
      contacts: [],
      score: { total: 80, priority: "high", components: {}, explanation: "" },
    };

    const output = {
      business: [{ text: "Company has revenue of $1M", cites: ["o1"] }],
      webPresence: [],
      opportunities: [],
      people: [],
      approach: [],
    };

    const result = screenResearchSummaryOutput(output);

    expect(result.output.business).toHaveLength(0);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.category).toBe("finance");
    expect(result.rejections[0]?.count).toBe(1);
  });

  it("assembleResearchSummaryInput maps company evidence to prompt input", () => {
    const facts = {
      company: {
        company: {
          name: "Test Co",
          industryId: "tech",
          countryId: "uae",
          cityId: "dubai",
          website: "https://test.co",
          linkedinUrl: null,
          companySize: null,
          description: null,
          discoverySource: "test",
          discoverySourceUrl: "https://test.co",
          discoveryRunId: null,
          verificationState: "never_checked",
          verifiedAt: null,
          verificationRunId: null,
          isExample: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        analysis: {
          observations: [
            {
              statement: "Site is modern",
              evidence: { detail: "Modern UI", url: "https://test.co", observedAt: new Date().toISOString() },
              certainty: "observed",
            },
          ],
          technologyStack: [],
        },
        detections: [],
        opportunities: [],
        contacts: [],
      },
      lead: {
        id: "lead-1",
        companyId: "company-1",
        leadScore: 80,
        priority: "high",
        businessFitScore: 25,
        technicalOpportunityScore: 25,
        businessOpportunityScore: 15,
        decisionMakerFoundScore: 10,
        companyQualityScore: 5,
        scoreExplanation: "Test",
        recommendedServiceId: null,
        contactReason: null,
        status: "new",
        weightVersion: 1,
        scoredAt: new Date(),
        isExample: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const input = assembleResearchSummaryInput(facts);

    expect(input.company.name).toBe("Test Co");
    expect(input.observations).toHaveLength(1);
    expect(input.observations[0]?.ref).toBe("o1");
    expect(input.score.total).toBe(80);
  });

  it("deriveUnknownFacts reports missing evidence", () => {
    const company = {
      companyId: "company-1",
      analysis: undefined,
      detections: [],
      opportunities: [],
      contacts: [],
      company: {
        id: "company-1",
        name: "Test Co",
        industryId: "tech",
        countryId: "uae",
        cityId: "dubai",
        website: "https://test.co",
        normalizedName: "test co",
        normalizedDomain: "test.co",
        linkedinUrl: null,
        companySize: null,
        description: null,
        discoverySource: "test",
        discoverySourceUrl: "https://test.co",
        discoveryRunId: null,
        verificationState: "never_checked",
        verifiedAt: null,
        verificationRunId: null,
        isExample: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const lead = {
      id: "lead-1",
      companyId: "company-1",
      leadScore: 80,
      priority: "high",
      businessFitScore: 25,
      technicalOpportunityScore: 25,
      businessOpportunityScore: 15,
      decisionMakerFoundScore: 10,
      companyQualityScore: 5,
      scoreExplanation: "Test",
      recommendedServiceId: null,
      contactReason: null,
      status: "new",
      weightVersion: 1,
      scoredAt: new Date(),
      isExample: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = deriveUnknownFacts(company as any, lead as any);

    expect(result.facts).toContain("company_description");
    expect(result.facts).toContain("company_size");
    expect(result.facts).toContain("website_analysis");
    expect(result.facts).toContain("opportunities");
    expect(result.facts).toContain("verification_status");
  });
});
