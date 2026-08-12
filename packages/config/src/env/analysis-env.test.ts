import { describe, expect, it } from "vitest";

import { apiEnvSchema } from "./api";

describe("analysis environment variables", () => {
  it("includes ANALYSIS_ARTIFACT_ROOT", () => {
    const shape = apiEnvSchema.shape;
    expect(shape.ANALYSIS_ARTIFACT_ROOT).toBeDefined();
  });

  it("includes ANALYSIS_NAVIGATION_TIMEOUT_MS", () => {
    const shape = apiEnvSchema.shape;
    expect(shape.ANALYSIS_NAVIGATION_TIMEOUT_MS).toBeDefined();
  });

  it("includes ANALYSIS_RUN_TIMEOUT_MS", () => {
    const shape = apiEnvSchema.shape;
    expect(shape.ANALYSIS_RUN_TIMEOUT_MS).toBeDefined();
  });

  it("includes ANALYSIS_MAX_PAGE_BYTES", () => {
    const shape = apiEnvSchema.shape;
    expect(shape.ANALYSIS_MAX_PAGE_BYTES).toBeDefined();
  });

  it("ANALYSIS_ARTIFACT_ROOT has a description", () => {
    const shape = apiEnvSchema.shape;
    const desc = shape.ANALYSIS_ARTIFACT_ROOT.description;
    expect(desc).toBeDefined();
    expect(desc!.length).toBeGreaterThan(0);
  });

  it("ANALYSIS_NAVIGATION_TIMEOUT_MS has a description", () => {
    const shape = apiEnvSchema.shape;
    const desc = shape.ANALYSIS_NAVIGATION_TIMEOUT_MS.description;
    expect(desc).toBeDefined();
    expect(desc!.length).toBeGreaterThan(0);
  });

  it("ANALYSIS_RUN_TIMEOUT_MS has a description", () => {
    const shape = apiEnvSchema.shape;
    const desc = shape.ANALYSIS_RUN_TIMEOUT_MS.description;
    expect(desc).toBeDefined();
    expect(desc!.length).toBeGreaterThan(0);
  });

  it("ANALYSIS_MAX_PAGE_BYTES has a description", () => {
    const shape = apiEnvSchema.shape;
    const desc = shape.ANALYSIS_MAX_PAGE_BYTES.description;
    expect(desc).toBeDefined();
    expect(desc!.length).toBeGreaterThan(0);
  });
});
