import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../internal/errors";
import { ACTIVE_INDUSTRIES, INDUSTRIES, findIndustry, parseIndustries } from "./industries";

describe("initial industries", () => {
  it("contains the five launch industries, all enabled", () => {
    const enabled = ACTIVE_INDUSTRIES.map((industry) => industry.name).sort();

    expect(enabled).toEqual([
      "Business Services",
      "E-Commerce",
      "Hospitality",
      "Logistics",
      "Real Estate",
    ]);
  });

  it("gives every industry a stable identifier", () => {
    expect(INDUSTRIES.map((industry) => industry.id).sort()).toEqual([
      "business_services",
      "ecommerce",
      "hospitality",
      "logistics",
      "real_estate",
    ]);
  });
});

describe("duplicate identifiers", () => {
  it("refuse to load, naming the duplicated identifier", () => {
    const load = (): unknown =>
      parseIndustries([
        { id: "logistics", name: "Logistics", enabled: true },
        { id: "logistics", name: "Freight and Logistics", enabled: true },
      ]);

    expect(load).toThrow(ConfigurationError);
    expect(load).toThrow(/Duplicate identifier: logistics/);
  });
});

describe("a disabled industry", () => {
  it("is excluded from the active list but stays resolvable", () => {
    const industries = parseIndustries([
      { id: "logistics", name: "Logistics", enabled: true },
      { id: "hospitality", name: "Hospitality", enabled: false },
    ]);

    expect(
      industries.filter((industry) => industry.enabled).map((industry) => industry.id),
    ).toEqual(["logistics"]);
    expect(industries.map((industry) => industry.id)).toContain("hospitality");
  });
});

describe("resolution", () => {
  it("returns undefined for an unknown identifier", () => {
    expect(findIndustry("mining")).toBeUndefined();
  });
});
