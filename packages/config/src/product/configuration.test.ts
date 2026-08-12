import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../internal/errors";
import { CATEGORIES, parseCategories, resolveOpportunityCategory } from "./services";

describe("invalid configuration halts loading", () => {
  it("identifies the failing field path and the reason for duplicate identifiers", () => {
    let thrown: unknown;
    try {
      parseCategories([
        { id: "website_modernization", name: "Website Modernization", serviceId: "website_modernization" },
        { id: "website_modernization", name: "Web Modernization", serviceId: "web_application_development" },
      ]);
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConfigurationError);
    const failure = thrown as ConfigurationError;

    expect(failure.subject).toBe("Opportunity category configuration");
    expect(failure.message).toContain('"website_modernization"');
  });

  it("returns nothing partially validated when a category maps to an unknown service", () => {
    const load = (): unknown =>
      parseCategories([
        { id: "website_modernization", name: "Website Modernization", serviceId: "unknown_service" },
      ]);

    expect(load).toThrow(ConfigurationError);
    expect(load).toThrow("Unknown service");
  });

  it("reports every failing field rather than only the first for duplicate and unknown service", () => {
    const load = (): unknown =>
      parseCategories([
        { id: "website_modernization", name: "Website Modernization", serviceId: "unknown_service" },
        { id: "web_application_development", name: "Web App Dev", serviceId: "also_unknown" },
      ]);

    expect(load).toThrow(ConfigurationError);
  });

  it("rejects an unknown category identifier rather than defaulting", () => {
    let thrown: unknown;
    try {
      resolveOpportunityCategory("non_existent_category");
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConfigurationError);
    const failure = thrown as ConfigurationError;

    expect(failure.subject).toBe("Opportunity category configuration");
    expect(failure.message).toContain("Configured categories");
  });
});

describe("consumers cannot mutate configuration", () => {
  it("freezes CATEGORIES and its entries", () => {
    expect(Object.isFrozen(CATEGORIES)).toBe(true);

    for (const entry of CATEGORIES) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  it("refuses an entry added to CATEGORIES", () => {
    const mutable = CATEGORIES as unknown as unknown[];
    expect(() => mutable.push({ id: "injected" } as any)).toThrow(TypeError);
    expect(CATEGORIES.some((entry) => entry.id === "injected")).toBe(false);
  });

  it("refuses a field reassigned on a category entry", () => {
    const [first] = CATEGORIES;
    expect(first).toBeDefined();

    expect(() => {
      if (first !== undefined) {
        ;(first as any).name = "Somewhere Else";
      }
    }).toThrow(TypeError);

    expect(CATEGORIES[0]?.name).toBe("Website Modernization");
  });
});