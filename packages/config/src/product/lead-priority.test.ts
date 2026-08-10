import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../internal/errors";
import { PRIORITY_BANDS, classifyPriority, parsePriorityBands } from "./lead-priority";

describe("configured bands", () => {
  it("are the four the product defines", () => {
    expect(PRIORITY_BANDS.map((band) => band.id)).toEqual(["low", "medium", "high", "very_high"]);
  });

  it("tile the whole 0-100 range", () => {
    expect(PRIORITY_BANDS[0]?.minimum).toBe(0);
    expect(PRIORITY_BANDS.at(-1)?.maximum).toBe(100);
  });
});

describe("classifying a score", () => {
  it("puts 92 in very_high", () => {
    expect(classifyPriority(92)).toBe("very_high");
  });

  it.each([
    [100, "very_high"],
    [90, "very_high"],
    [89, "high"],
    [80, "high"],
    [79, "medium"],
    [70, "medium"],
    [69, "low"],
    [0, "low"],
  ])("classifies %i as %s", (score, expected) => {
    expect(classifyPriority(score)).toBe(expected);
  });
});

describe("an out-of-range score", () => {
  it("is refused below zero, stating the valid range", () => {
    const classify = (): unknown => classifyPriority(-1);

    expect(classify).toThrow(ConfigurationError);
    expect(classify).toThrow(/Valid range is 0 to 100 inclusive/);
  });

  it("is refused above one hundred, stating the valid range", () => {
    expect(() => classifyPriority(101)).toThrow(/Valid range is 0 to 100 inclusive/);
  });

  it("refuses a non-integer score rather than rounding it into a band", () => {
    expect(() => classifyPriority(89.5)).toThrow(/Expected a whole number between 0 and 100/);
  });
});

describe("band validation", () => {
  it("refuses a gap in coverage", () => {
    const load = (): unknown =>
      parsePriorityBands([
        { id: "low", name: "Low", minimum: 0, maximum: 68 },
        { id: "high", name: "High", minimum: 70, maximum: 100 },
      ]);

    expect(load).toThrow(/No band covers scores 69 to 69/);
  });

  it("refuses an overlap", () => {
    const load = (): unknown =>
      parsePriorityBands([
        { id: "low", name: "Low", minimum: 0, maximum: 70 },
        { id: "high", name: "High", minimum: 70, maximum: 100 },
      ]);

    expect(load).toThrow(/overlapping the band that ends at 70/);
  });

  it("refuses bands that stop short of one hundred", () => {
    const load = (): unknown =>
      parsePriorityBands([{ id: "low", name: "Low", minimum: 0, maximum: 99 }]);

    expect(load).toThrow(/No band covers scores 100 to 100/);
  });

  it("refuses bands that do not start at zero", () => {
    const load = (): unknown =>
      parsePriorityBands([{ id: "low", name: "Low", minimum: 1, maximum: 100 }]);

    expect(load).toThrow(/No band covers scores 0 to 0/);
  });

  it("refuses a band whose minimum exceeds its maximum", () => {
    const load = (): unknown =>
      parsePriorityBands([{ id: "low", name: "Low", minimum: 100, maximum: 0 }]);

    expect(load).toThrow(/minimum must not exceed its maximum/);
  });

  it("refuses a duplicated band identifier", () => {
    const load = (): unknown =>
      parsePriorityBands([
        { id: "low", name: "Low", minimum: 0, maximum: 50 },
        { id: "low", name: "Also Low", minimum: 51, maximum: 100 },
      ]);

    expect(load).toThrow(/Duplicate identifier: low/);
  });

  it("accepts retuned bands that still tile the range", () => {
    const bands = parsePriorityBands([
      { id: "low", name: "Low", minimum: 0, maximum: 59 },
      { id: "high", name: "High", minimum: 60, maximum: 100 },
    ]);

    expect(bands.map((band) => band.id)).toEqual(["low", "high"]);
  });
});
