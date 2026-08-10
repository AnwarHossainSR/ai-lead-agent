import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../internal/errors";
import { INDUSTRIES, parseIndustries } from "./industries";
import { LIFECYCLE } from "./lead-lifecycle";
import { PRIORITY_BANDS } from "./lead-priority";
import { SCORE_COMPONENTS } from "./lead-scoring";
import { CITIES, COUNTRIES } from "./markets";
import { OUTREACH_CHANNELS } from "./outreach";
import { SERVICES } from "./services";

describe("invalid configuration halts loading", () => {
  it("identifies the failing field path and the reason", () => {
    let thrown: unknown;
    try {
      parseIndustries([{ id: "real_estate", name: "Real Estate", enabled: "yes" }]);
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConfigurationError);
    const failure = thrown as ConfigurationError;

    expect(failure.subject).toBe("Industry configuration");
    expect(failure.message).toContain("0.enabled");
    expect(failure.message).toContain("expected boolean");
  });

  it("returns nothing partially validated", () => {
    // The first entry is valid and the second is not. Nothing is returned at
    // all — a caller cannot end up holding the half that parsed.
    const load = (): unknown =>
      parseIndustries([
        { id: "real_estate", name: "Real Estate", enabled: true },
        { id: "logistics", name: "Logistics" },
      ]);

    expect(load).toThrow(ConfigurationError);
    expect(load).toThrow(/1\.enabled/);
  });

  it("reports every failing field rather than only the first", () => {
    const load = (): unknown => parseIndustries([{ id: "Real Estate", name: "", enabled: true }]);

    expect(load).toThrow(/0\.id/);
    expect(load).toThrow(/0\.name/);
  });
});

const collections = [
  ["COUNTRIES", COUNTRIES],
  ["CITIES", CITIES],
  ["INDUSTRIES", INDUSTRIES],
  ["SERVICES", SERVICES],
  ["PRIORITY_BANDS", PRIORITY_BANDS],
  ["SCORE_COMPONENTS", SCORE_COMPONENTS],
  ["OUTREACH_CHANNELS", OUTREACH_CHANNELS],
] as const;

describe("consumers cannot mutate configuration", () => {
  it.each(collections)("freezes %s and its entries", (_name, collection) => {
    expect(Object.isFrozen(collection)).toBe(true);

    for (const entry of collection) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
  });

  it.each(collections)("refuses an entry added to %s", (_name, collection) => {
    const mutable = collection as unknown as unknown[];
    expect(() => mutable.push({ id: "injected" })).toThrow(TypeError);
    expect(collection.some((entry) => entry.id === "injected")).toBe(false);
  });

  it("refuses a field reassigned on an entry", () => {
    const [first] = COUNTRIES;
    expect(first).toBeDefined();

    expect(() => {
      if (first !== undefined) {
        first.name = "Somewhere Else";
      }
    }).toThrow(TypeError);

    expect(COUNTRIES[0]?.name).toBe("United Arab Emirates");
  });

  it("freezes the lifecycle transition map and its entries", () => {
    expect(Object.isFrozen(LIFECYCLE)).toBe(true);
    expect(Object.isFrozen(LIFECYCLE.transitions)).toBe(true);
    expect(Object.isFrozen(LIFECYCLE.transitions["discovered"])).toBe(true);
  });
});
