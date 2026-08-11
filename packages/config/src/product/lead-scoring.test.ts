import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../internal/errors";
import { SCORE_COMPONENTS, parseScoreComponents, resolveScoreComponent } from "./lead-scoring";

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
