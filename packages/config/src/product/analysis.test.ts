import { describe, expect, it } from "vitest";

import {
  ANALYSIS_CONFIG,
  parseAnalysisConfig,
} from "./analysis";

describe("analysis configuration", () => {
  it("loads the default configuration successfully", () => {
    expect(ANALYSIS_CONFIG).toBeDefined();
    expect(ANALYSIS_CONFIG.viewports).toHaveLength(2);
    expect(ANALYSIS_CONFIG.extraPaths).toBeDefined();
    expect(ANALYSIS_CONFIG.observationRules).toBeDefined();
    expect(ANALYSIS_CONFIG.stalenessDays).toBeGreaterThan(0);
  });

  it("has desktop and mobile viewports", () => {
    const viewportNames = ANALYSIS_CONFIG.viewports.map((v) => v.name);
    expect(viewportNames).toContain("desktop");
    expect(viewportNames).toContain("mobile");
  });

  it("desktop viewport has standard dimensions", () => {
    const desktop = ANALYSIS_CONFIG.viewports.find((v) => v.name === "desktop");
    expect(desktop).toBeDefined();
    expect(desktop!.width).toBe(1920);
    expect(desktop!.height).toBe(1080);
  });

  it("mobile viewport has standard dimensions", () => {
    const mobile = ANALYSIS_CONFIG.viewports.find((v) => v.name === "mobile");
    expect(mobile).toBeDefined();
    expect(mobile!.width).toBe(375);
    expect(mobile!.height).toBe(812);
  });

  it("extra paths are relative and start with /", () => {
    for (const path of ANALYSIS_CONFIG.extraPaths) {
      expect(path.startsWith("/")).toBe(true);
      expect(path.includes("://")).toBe(false);
    }
  });

  it("observation thresholds are between 0 and 100", () => {
    for (const rule of ANALYSIS_CONFIG.observationRules) {
      expect(rule.threshold).toBeGreaterThanOrEqual(0);
      expect(rule.threshold).toBeLessThanOrEqual(100);
    }
  });

  it("staleness window is positive", () => {
    expect(ANALYSIS_CONFIG.stalenessDays).toBeGreaterThan(0);
  });

  it("makes configuration immutable", () => {
    expect(Object.isFrozen(ANALYSIS_CONFIG)).toBe(true);
  });
});

describe("parseAnalysisConfig", () => {
  it("accepts a valid configuration", () => {
    const config = parseAnalysisConfig({
      viewports: [{ name: "desktop", width: 1920, height: 1080 }],
      extraPaths: ["/about"],
      observationRules: [{ id: "no-https", threshold: 100 }],
      stalenessDays: 30,
    });
    expect(config.viewports).toHaveLength(1);
  });

  it("rejects a configuration with no viewports", () => {
    expect(() =>
      parseAnalysisConfig({
        viewports: [],
        extraPaths: [],
        observationRules: [],
        stalenessDays: 30,
      }),
    ).toThrow();
  });

  it("rejects a configuration with negative staleness", () => {
    expect(() =>
      parseAnalysisConfig({
        viewports: [{ name: "desktop", width: 1920, height: 1080 }],
        extraPaths: [],
        observationRules: [],
        stalenessDays: -1,
      }),
    ).toThrow();
  });

  it("rejects a viewport with zero width", () => {
    expect(() =>
      parseAnalysisConfig({
        viewports: [{ name: "desktop", width: 0, height: 1080 }],
        extraPaths: [],
        observationRules: [],
        stalenessDays: 30,
      }),
    ).toThrow();
  });

  it("rejects an extra path that is absolute", () => {
    expect(() =>
      parseAnalysisConfig({
        viewports: [{ name: "desktop", width: 1920, height: 1080 }],
        extraPaths: ["https://example.com/about"],
        observationRules: [],
        stalenessDays: 30,
      }),
    ).toThrow();
  });
});

describe("analysis configuration constraints", () => {
  it("contains no proxy configuration", () => {
    const configStr = JSON.stringify(ANALYSIS_CONFIG);
    expect(configStr).not.toContain("proxy");
    expect(configStr).not.toContain("proxyUrl");
  });

  it("contains no user-agent-rotation configuration", () => {
    const configStr = JSON.stringify(ANALYSIS_CONFIG);
    expect(configStr).not.toContain("userAgentRotation");
    expect(configStr).not.toContain("rotateUserAgent");
  });

  it("contains no challenge-solving configuration", () => {
    const configStr = JSON.stringify(ANALYSIS_CONFIG);
    expect(configStr).not.toContain("challengeSolver");
    expect(configStr).not.toContain("solveChallenge");
    expect(configStr).not.toContain("captcha");
  });
});
