import { describe, expect, it } from "vitest";

import {
  DEFAULT_RESPONSE_CATEGORIES,
  MINIMUM_REPORTING_SAMPLE_SIZE,
  NO_RESPONSE_INTERVAL_DAYS,
  OUTREACH_TRACKING_CONFIG,
  findResponseCategory,
  parseOutreachTrackingConfig,
  parseResponseCategories,
  resolveResponseCategory,
} from "./outreach-tracking";

describe("default response categories", () => {
  it("are interested, not_interested, unsubscribe and out_of_office", () => {
    expect(DEFAULT_RESPONSE_CATEGORIES.map((category) => category.id)).toEqual([
      "interested",
      "not_interested",
      "unsubscribe",
      "out_of_office",
    ]);
  });

  it("each carry a proposed transition", () => {
    for (const category of DEFAULT_RESPONSE_CATEGORIES) {
      expect(category.proposedTransition.length).toBeGreaterThan(0);
    }
  });
});

describe("default outreach tracking config", () => {
  it("sets the no-response interval to 14 days", () => {
    expect(NO_RESPONSE_INTERVAL_DAYS).toBe(14);
    expect(OUTREACH_TRACKING_CONFIG.noResponseIntervalDays).toBe(14);
  });

  it("sets the minimum reporting sample size to 10", () => {
    expect(MINIMUM_REPORTING_SAMPLE_SIZE).toBe(10);
    expect(OUTREACH_TRACKING_CONFIG.minimumReportingSampleSize).toBe(10);
  });
});

describe("parsing response categories", () => {
  it("accepts a well-formed category list", () => {
    const categories = parseResponseCategories([
      { id: "positive", name: "Positive", proposedTransition: "interested" },
    ]);

    expect(categories).toHaveLength(1);
    expect(categories[0]!.id).toBe("positive");
  });

  it("refuses a duplicate category identifier, naming the duplicate", () => {
    const load = (): unknown =>
      parseResponseCategories([
        { id: "dup", name: "First", proposedTransition: "interested" },
        { id: "dup", name: "Second", proposedTransition: "not_interested" },
      ]);

    expect(load).toThrow(/Duplicate identifier: dup/);
  });

  it("refuses a category naming an unknown status", () => {
    const load = (): unknown =>
      parseResponseCategories([{ id: "weird", name: "Weird", proposedTransition: "nonexistent" }]);

    expect(load).toThrow(/Category "weird" proposes transition to "nonexistent"/);
  });

  it("refuses a category proposing an impermissible transition", () => {
    const load = (): unknown =>
      parseResponseCategories([{ id: "skip", name: "Skip", proposedTransition: "discovered" }]);

    expect(load).toThrow(/Category "skip" proposes transition to "discovered"/);
  });
});

describe("resolving a response category", () => {
  it("returns the configured entry for a known identifier", () => {
    expect(resolveResponseCategory("interested").name).toBe("Interested");
  });

  it("refuses an unknown identifier rather than returning a default", () => {
    expect(() => resolveResponseCategory("unknown")).toThrow(/Unknown response category "unknown"/);
  });

  it("lists the configured categories in the refusal", () => {
    expect(() => resolveResponseCategory("unknown")).toThrow(/interested/);
    expect(() => resolveResponseCategory("unknown")).toThrow(/not_interested/);
  });

  it("distinguishes lookup from resolution", () => {
    expect(findResponseCategory("unknown")).toBeUndefined();
    expect(findResponseCategory("interested")?.name).toBe("Interested");
  });
});

describe("parsing outreach tracking config", () => {
  it("accepts a well-formed config", () => {
    const config = parseOutreachTrackingConfig({
      noResponseIntervalDays: 21,
      minimumReportingSampleSize: 5,
    });

    expect(config.noResponseIntervalDays).toBe(21);
    expect(config.minimumReportingSampleSize).toBe(5);
  });

  it("refuses a non-positive no-response interval", () => {
    expect(() =>
      parseOutreachTrackingConfig({ noResponseIntervalDays: 0, minimumReportingSampleSize: 10 }),
    ).toThrow(/noResponseIntervalDays/);
  });

  it("refuses a negative no-response interval", () => {
    expect(() =>
      parseOutreachTrackingConfig({ noResponseIntervalDays: -1, minimumReportingSampleSize: 10 }),
    ).toThrow(/noResponseIntervalDays/);
  });

  it("refuses a non-positive minimum reporting sample size", () => {
    expect(() =>
      parseOutreachTrackingConfig({ noResponseIntervalDays: 14, minimumReportingSampleSize: 0 }),
    ).toThrow(/minimumReportingSampleSize/);
  });

  it("refuses a negative minimum reporting sample size", () => {
    expect(() =>
      parseOutreachTrackingConfig({ noResponseIntervalDays: 14, minimumReportingSampleSize: -5 }),
    ).toThrow(/minimumReportingSampleSize/);
  });
});
