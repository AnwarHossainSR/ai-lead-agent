import { describe, expect, it } from "vitest";
import { opportunityAnalysisOutputSchema } from "../opportunity-analysis/v1";

describe("opportunity analysis output schema shape", () => {
  it("output schema is a discriminated union with two outcomes", () => {
    const shape = opportunityAnalysisOutputSchema._def;
    const options = shape?.options;
    expect(options).toBeDefined();
    expect(options).toHaveLength(2);
  });

  it("opportunity outcome can be parsed with required fields", () => {
    const parsed = opportunityAnalysisOutputSchema.parse({
      outcome: "opportunities",
      opportunities: [
        {
          categoryId: "website_modernization",
          title: "Test opportunity",
          description: "Test description",
          impact: "Test business impact",
          citedEvidence: ["o1"],
        },
      ],
    });

    expect(parsed.outcome).toBe("opportunities");
    expect(parsed.opportunities).toHaveLength(1);
    expect(parsed.opportunities[0].categoryId).toBe("website_modernization");
    expect(parsed.opportunities[0].title).toBe("Test opportunity");
    expect(parsed.opportunities[0].description).toBe("Test description");
    expect(parsed.opportunities[0].impact).toBe("Test business impact");
    expect(parsed.opportunities[0].citedEvidence).toEqual(["o1"]);
  });

  it("insufficient_evidence outcome can be parsed with reason", () => {
    const parsed = opportunityAnalysisOutputSchema.parse({
      outcome: "insufficient_evidence",
      reason: "Not enough observations or detections to support an opportunity",
    });

    expect(parsed.outcome).toBe("insufficient_evidence");
    expect(parsed.reason).toBe("Not enough observations or detections to support an opportunity");
  });

  it("parsed opportunities array is non-empty", () => {
    const parsed = opportunityAnalysisOutputSchema.parse({
      outcome: "opportunities",
      opportunities: [
        {
          categoryId: "web_application_development",
          title: "Custom platform",
          description: "A tailored customer portal",
          impact: "Enables new revenue streams",
          citedEvidence: ["t1", "o2"],
        },
      ],
    });

    expect(parsed.opportunities).toHaveLength(1);
    expect(parsed.opportunities[0].categoryId).toBe("web_application_development");
    expect(parsed.opportunities[0].impact).toContain("revenue");
  });
});