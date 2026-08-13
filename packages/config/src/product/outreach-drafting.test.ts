import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROHIBITED_CONTENT_CATEGORIES,
  findProhibitedContentCategory,
  parseProhibitedContentCategories,
  resolveProhibitedContentCategory,
} from "./outreach-drafting";

describe("prohibited content categories", () => {
  it("parses valid categories", () => {
    const categories = parseProhibitedContentCategories([
      {
        id: "invented_fact",
        name: "Invented Fact",
        patterns: ["we noticed", "we saw"],
      },
    ]);

    expect(categories).toHaveLength(1);
    expect(categories[0]?.id).toBe("invented_fact");
  });

  it("rejects duplicate identifiers", () => {
    expect(() =>
      parseProhibitedContentCategories([
        { id: "invented_fact", name: "Invented Fact", patterns: ["we noticed"] },
        { id: "invented_fact", name: "Invented Fact Again", patterns: ["we saw"] },
      ]),
    ).toThrow(/Duplicate identifier: invented_fact/);
  });

  it("rejects an empty category list", () => {
    expect(() => parseProhibitedContentCategories([])).toThrow(/expected array to have >=1 items/);
  });

  it("rejects a category without patterns", () => {
    expect(() =>
      parseProhibitedContentCategories([
        { id: "invented_fact", name: "Invented Fact", patterns: [] },
      ]),
    ).toThrow(/expected array to have >=1 items/);
  });

  it("resolves a configured category", () => {
    expect(resolveProhibitedContentCategory("invented_fact").name).toBe("Invented Fact");
  });

  it("refuses an unknown category identifier", () => {
    expect(() => resolveProhibitedContentCategory("unknown")).toThrow(
      /Unknown prohibited content category "unknown"/,
    );
  });

  it("exposes the default categories", () => {
    expect(DEFAULT_PROHIBITED_CONTENT_CATEGORIES).toHaveLength(5);
    const ids = DEFAULT_PROHIBITED_CONTENT_CATEGORIES.map((category) => category.id);
    expect(ids).toEqual([
      "invented_fact",
      "promised_outcome",
      "false_relationship",
      "commercial_terms",
      "urgency_pressure",
    ]);
  });

  it("has no empty pattern strings in defaults", () => {
    for (const category of DEFAULT_PROHIBITED_CONTENT_CATEGORIES) {
      for (const pattern of category.patterns) {
        expect(pattern.length).toBeGreaterThan(0);
      }
    }
  });

  it("rejects patterns that could cause catastrophic backtracking", () => {
    expect(() =>
      parseProhibitedContentCategories([
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
      parseProhibitedContentCategories([
        {
          id: "dangerous",
          name: "Dangerous",
          patterns: ["[abc"],
        },
      ]),
    ).toThrow(/unsafe/);
  });

  it("finds categories by identifier", () => {
    expect(findProhibitedContentCategory("promised_outcome")?.name).toBe("Promised Outcome");
    expect(findProhibitedContentCategory("missing")).toBeUndefined();
  });

  it("each default category has a non-empty name and at least one pattern", () => {
    for (const category of DEFAULT_PROHIBITED_CONTENT_CATEGORIES) {
      expect(category.name.length).toBeGreaterThan(0);
      expect(category.patterns.length).toBeGreaterThan(0);
    }
  });
});
