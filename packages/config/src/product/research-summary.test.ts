import { describe, expect, it } from "vitest";

import {
  ConfigurationError,
  DEFAULT_PROHIBITED_CLAIM_CATEGORIES,
  findProhibitedClaimCategory,
  parseProhibitedClaimCategories,
  prohibitedClaimCategoriesSchema,
  resolveProhibitedClaimCategory,
} from "./research-summary";

describe("prohibited claim categories", () => {
  it("parses valid categories", () => {
    const categories = parseProhibitedClaimCategories([
      {
        id: "finance",
        name: "Finance",
        patterns: ["revenue", "turnover"],
      },
    ]);

    expect(categories).toHaveLength(1);
    expect(categories[0]?.id).toBe("finance");
  });

  it("rejects duplicate identifiers", () => {
    expect(() =>
      parseProhibitedClaimCategories([
        { id: "finance", name: "Finance", patterns: ["revenue"] },
        { id: "finance", name: "Finance Again", patterns: ["turnover"] },
      ]),
    ).toThrow(/Duplicate identifier: finance/);
  });

  it("rejects an empty category list", () => {
    expect(() => parseProhibitedClaimCategories([])).toThrow(/expected array to have >=1 items/);
  });

  it("rejects a category without patterns", () => {
    expect(() =>
      parseProhibitedClaimCategories([{ id: "finance", name: "Finance", patterns: [] }]),
    ).toThrow(/expected array to have >=1 items/);
  });

  it("resolves a configured category", () => {
    expect(resolveProhibitedClaimCategory("finance").name).toBe("Finance");
  });

  it("refuses an unknown category identifier", () => {
    expect(() => resolveProhibitedClaimCategory("unknown")).toThrow(
      /Unknown prohibited claim category "unknown"/,
    );
  });

  it("exposes the default categories", () => {
    expect(DEFAULT_PROHIBITED_CLAIM_CATEGORIES).toHaveLength(6);
    const ids = DEFAULT_PROHIBITED_CLAIM_CATEGORIES.map((category) => category.id);
    expect(ids).toEqual(["finance", "size", "hiring", "trajectory", "plans", "customers"]);
  });

  it("has no empty pattern strings in defaults", () => {
    for (const category of DEFAULT_PROHIBITED_CLAIM_CATEGORIES) {
      for (const pattern of category.patterns) {
        expect(pattern.length).toBeGreaterThan(0);
      }
    }
  });

  it("rejects patterns that could cause catastrophic backtracking", () => {
    expect(() =>
      parseProhibitedClaimCategories([
        {
          id: "dangerous",
          name: "Dangerous",
          patterns: ["(a+)+b"],
        },
      ]),
    ).toThrow(/unsafe/);
  });

  it("rejects patterns with unclosed character classes", () => {
    expect(() =>
      parseProhibitedClaimCategories([
        {
          id: "dangerous",
          name: "Dangerous",
          patterns: ["[abc"],
        },
      ]),
    ).toThrow(/unsafe/);
  });

  it("finds categories by identifier", () => {
    expect(findProhibitedClaimCategory("hiring")?.name).toBe("Hiring");
    expect(findProhibitedClaimCategory("missing")).toBeUndefined();
  });
});
