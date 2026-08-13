import { describe, expect, it } from "vitest";

import {
  CONFIGURED_TECHNOLOGIES,
  DEFAULT_BUSINESS_FIT_PROFILE,
  DEFAULT_WEIGHT_VERSION,
  SCORE_COMPONENTS,
  ConfigurationError,
  computeFingerprint,
  parseBusinessFitProfile,
  parseComponentRules,
  parseScoreComponents,
  parseWeightVersion,
  validateComponentRules,
  validateWeightVersion,
} from "./lead-scoring";

describe("scoring weights carry a version", () => {
  it("exposes the version alongside the weights", () => {
    expect(DEFAULT_WEIGHT_VERSION.version).toBe(1);
    expect(DEFAULT_WEIGHT_VERSION.fingerprint).toBe(computeFingerprint(SCORE_COMPONENTS));
  });

  it("fails when weights differ from the recorded fingerprint", () => {
    const modified = parseScoreComponents([
      { id: "business_fit", name: "Business Fit", maximum: 40 },
      { id: "technical_opportunity", name: "Technical Opportunity", maximum: 30 },
      { id: "business_opportunity", name: "Business Opportunity", maximum: 20 },
      { id: "decision_maker_found", name: "Decision Maker Found", maximum: 5 },
      { id: "company_quality", name: "Company Quality", maximum: 5 },
    ]);

    expect(() =>
      validateWeightVersion({ version: 1, fingerprint: computeFingerprint(SCORE_COMPONENTS) }, modified),
    ).toThrow(/does not match/);
  });

  it("accepts the fingerprint when weights match", () => {
    expect(() =>
      validateWeightVersion(
        { version: 1, fingerprint: computeFingerprint(SCORE_COMPONENTS) },
        SCORE_COMPONENTS,
      ),
    ).not.toThrow();
  });
});

describe("every configured weight has an implemented scorer", () => {
  it("maps every configured component to a known scorer identifier", () => {
    const knownScorers = [
      "website_quality",
      "technology_fit",
      "opportunity_strength",
      "contact_reachability",
      "business_fit",
    ];

    for (const component of SCORE_COMPONENTS) {
      expect(knownScorers).toContain(component.id);
    }
  });

  it("has no scorer without a configured weight", () => {
    const configuredIds = new Set(SCORE_COMPONENTS.map((component) => component.id));
    const knownScorers = [
      "website_quality",
      "technology_fit",
      "opportunity_strength",
      "contact_reachability",
      "business_fit",
    ];

    for (const scorer of knownScorers) {
      expect(configuredIds.has(scorer)).toBe(true);
    }
  });
});

describe("per-component scoring rules", () => {
  it("validates overlapping bands", () => {
    const load = (): ComponentRules =>
      parseComponentRules([
        {
          thresholds: [
            { minimum: 0, maximum: 50, points: 50 },
            { minimum: 40, maximum: 100, points: 100 },
          ],
          unknownCeiling: 20,
        },
      ]);

    expect(load).toThrow(/overlapping thresholds/);
  });

  it("validates a rule that cannot reach a valid value", () => {
    const load = (): ComponentRules =>
      parseComponentRules([
        {
          thresholds: [
            { minimum: 0, maximum: 50, points: 50 },
            { minimum: 51, maximum: 100, points: 101 },
          ],
          unknownCeiling: 20,
        },
      ]);

    expect(load).toThrow(/outside 0 to 100/);
  });

  it("validates gaps in coverage", () => {
    const load = (): ComponentRules =>
      parseComponentRules([
        {
          thresholds: [
            { minimum: 0, maximum: 50, points: 50 },
            { minimum: 52, maximum: 100, points: 100 },
          ],
          unknownCeiling: 20,
        },
      ]);

    expect(load).toThrow(/has a gap/);
  });

  it("accepts valid bands that tile the range", () => {
    const rules = parseComponentRules([
      {
        thresholds: [
          { minimum: 0, maximum: 24, points: 0 },
          { minimum: 25, maximum: 49, points: 25 },
          { minimum: 50, maximum: 74, points: 50 },
          { minimum: 75, maximum: 100, points: 100 },
        ],
        unknownCeiling: 30,
      },
    ]);

    expect(rules[0]?.thresholds).toHaveLength(4);
    expect(rules[0]?.unknownCeiling).toBe(30);
  });
});

describe("target business profile configuration", () => {
  it("requires at least one target industry and country", () => {
    const load = (): unknown =>
      parseBusinessFitProfile({
        targetIndustryIds: [],
        targetCountryIds: [],
        targetCityIds: [],
        preferredCompanySizes: [],
      });

    expect(load).toThrow(/targetIndustryIds/);
  });

  it("accepts a complete profile", () => {
    expect(() => parseBusinessFitProfile(DEFAULT_BUSINESS_FIT_PROFILE)).not.toThrow();
  });

  it("rejects an unknown industry identifier", () => {
    const load = (): unknown =>
      parseBusinessFitProfile({
        targetIndustryIds: ["unknown_industry"],
        targetCountryIds: ["uae"],
        targetCityIds: [],
        preferredCompanySizes: [],
      });

    expect(load).toThrow(/Expected a lower_snake_case identifier/);
  });

  it("allows zero target cities", () => {
    const profile = parseBusinessFitProfile({
      targetIndustryIds: ["real_estate"],
      targetCountryIds: ["uae"],
      targetCityIds: [],
      preferredCompanySizes: [],
    });

    expect(profile.targetCityIds).toHaveLength(0);
  });
});

describe("configured technologies the operator sells against", () => {
  it("contains known technology identifiers", () => {
    expect(CONFIGURED_TECHNOLOGIES).toContain("wordpress");
    expect(CONFIGURED_TECHNOLOGIES).toContain("woocommerce");
    expect(CONFIGURED_TECHNOLOGIES).toContain("aws");
  });

  it("contains no empty identifiers", () => {
    for (const technology of CONFIGURED_TECHNOLOGIES) {
      expect(technology.length).toBeGreaterThan(0);
    }
  });

  it("has unique identifiers", () => {
    const unique = new Set(CONFIGURED_TECHNOLOGIES);
    expect(unique.size).toBe(CONFIGURED_TECHNOLOGIES.length);
  });
});

describe("default scoring weights", () => {
  it("are the five components the product defines", () => {
    expect(SCORE_COMPONENTS.map((component) => [component.id, component.maximum])).toEqual([
      ["business_fit", 30],
      ["technical_opportunity", 30],
      ["business_opportunity", 20],
      ["decision_maker_found", 10],
      ["company_quality", 10],
    ]);
  });

  it("total one hundred", () => {
    const total = SCORE_COMPONENTS.reduce((sum, component) => sum + component.maximum, 0);
    expect(total).toBe(100);
  });
});

describe("weights that do not total one hundred", () => {
  it("are refused, reporting the actual total", () => {
    const load = (): unknown =>
      parseScoreComponents([
        { id: "business_fit", name: "Business Fit", maximum: 30 },
        { id: "company_quality", name: "Company Quality", maximum: 40 },
      ]);

    expect(load).toThrow(ConfigurationError);
    expect(load).toThrow(/total 70, but must total 100/);
  });

  it("are refused when they exceed one hundred", () => {
    const load = (): unknown =>
      parseScoreComponents([
        { id: "business_fit", name: "Business Fit", maximum: 60 },
        { id: "company_quality", name: "Company Quality", maximum: 60 },
      ]);

    expect(load).toThrow(/total 120, but must total 100/);
  });
});

describe("retuning weights", () => {
  it("is accepted while the total stays at one hundred", () => {
    const components = parseScoreComponents([
      { id: "business_fit", name: "Business Fit", maximum: 40 },
      { id: "technical_opportunity", name: "Technical Opportunity", maximum: 20 },
      { id: "business_opportunity", name: "Business Opportunity", maximum: 20 },
      { id: "decision_maker_found", name: "Decision Maker Found", maximum: 10 },
      { id: "company_quality", name: "Company Quality", maximum: 10 },
    ]);

    expect(components[0]?.maximum).toBe(40);
    expect(components[1]?.maximum).toBe(20);
  });
});

describe("resolving a component", () => {
  it("returns the configured entry", () => {
    expect(resolveScoreComponent("business_fit").name).toBe("Business Fit");
  });

  it("refuses an unknown identifier", () => {
    expect(() => resolveScoreComponent("gut_feel")).toThrow(/Unknown score component "gut_feel"/);
  });
});

describe("component validation", () => {
  it("refuses a duplicated identifier", () => {
    const load = (): unknown =>
      parseScoreComponents([
        { id: "business_fit", name: "Business Fit", maximum: 50 },
        { id: "business_fit", name: "Fit", maximum: 50 },
      ]);

    expect(load).toThrow(/Duplicate identifier: business_fit/);
  });

  it("refuses a component worth zero points", () => {
    const load = (): unknown =>
      parseScoreComponents([
        { id: "business_fit", name: "Business Fit", maximum: 0 },
        { id: "company_quality", name: "Company Quality", maximum: 100 },
      ]);

    expect(load).toThrow(/0\.maximum/);
  });
});
