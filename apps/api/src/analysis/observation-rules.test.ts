import { describe, expect, it } from "vitest";

import {
  noHttpsRule,
  missingViewportMetaRule,
  consoleErrorsRule,
  failedRequestsRule,
  missingTitleRule,
  missingMetaDescriptionRule,
  missingFaviconRule,
  excessivePageWeightRule,
  runObservationRules,
  type PageCapture,
} from "./observation-rules";

function makeCapture(overrides?: Partial<PageCapture>): PageCapture {
  return {
    url: "https://example.com",
    status: 200,
    headers: {},
    html: "<!DOCTYPE html><html><head><title>Test</title><meta name='description' content='Test'><meta name='viewport' content='width=device-width'><link rel='icon' href='/favicon.ico'></head><body></body></html>",
    consoleMessages: [],
    failedRequests: [],
    transferSize: 1024,
    ...overrides,
  };
}

describe("observation rules", () => {
  describe("noHttpsRule", () => {
    it("returns observation for HTTP sites", () => {
      const capture = makeCapture({ url: "http://example.com" });
      const observations = noHttpsRule(capture);
      expect(observations).toHaveLength(1);
      expect(observations[0]?.description).toContain("HTTPS");
    });

    it("returns empty for HTTPS sites", () => {
      const capture = makeCapture({ url: "https://example.com" });
      const observations = noHttpsRule(capture);
      expect(observations).toHaveLength(0);
    });
  });

  describe("missingViewportMetaRule", () => {
    it("returns observation when viewport is missing", () => {
      const capture = makeCapture({ html: "<html><head></head></html>" });
      const observations = missingViewportMetaRule(capture);
      expect(observations).toHaveLength(1);
      expect(observations[0]?.description).toContain("viewport");
    });

    it("returns empty when viewport is present", () => {
      const capture = makeCapture();
      const observations = missingViewportMetaRule(capture);
      expect(observations).toHaveLength(0);
    });
  });

  describe("consoleErrorsRule", () => {
    it("returns observation for console errors", () => {
      const capture = makeCapture({
        consoleMessages: [{ type: "error", text: "test error" }],
      });
      const observations = consoleErrorsRule(capture);
      expect(observations).toHaveLength(1);
      expect(observations[0]?.description).toContain("1 console error");
    });

    it("returns empty when no errors", () => {
      const capture = makeCapture();
      const observations = consoleErrorsRule(capture);
      expect(observations).toHaveLength(0);
    });
  });

  describe("failedRequestsRule", () => {
    it("returns observation for failed requests", () => {
      const capture = makeCapture({
        failedRequests: [{ url: "/script.js", error: "net::ERR_FAILED" }],
      });
      const observations = failedRequestsRule(capture);
      expect(observations).toHaveLength(1);
      expect(observations[0]?.description).toContain("1 failed request");
    });

    it("returns empty when no failures", () => {
      const capture = makeCapture();
      const observations = failedRequestsRule(capture);
      expect(observations).toHaveLength(0);
    });
  });

  describe("missingTitleRule", () => {
    it("returns observation when title is missing", () => {
      const capture = makeCapture({ html: "<html><head></head></html>" });
      const observations = missingTitleRule(capture);
      expect(observations).toHaveLength(1);
      expect(observations[0]?.description).toContain("title");
    });

    it("returns observation when title is empty", () => {
      const capture = makeCapture({ html: "<html><head><title></title></head></html>" });
      const observations = missingTitleRule(capture);
      expect(observations).toHaveLength(1);
    });

    it("returns empty when title is present", () => {
      const capture = makeCapture();
      const observations = missingTitleRule(capture);
      expect(observations).toHaveLength(0);
    });
  });

  describe("missingMetaDescriptionRule", () => {
    it("returns observation when description is missing", () => {
      const capture = makeCapture({ html: "<html><head></head></html>" });
      const observations = missingMetaDescriptionRule(capture);
      expect(observations).toHaveLength(1);
      expect(observations[0]?.description).toContain("meta description");
    });

    it("returns empty when description is present", () => {
      const capture = makeCapture();
      const observations = missingMetaDescriptionRule(capture);
      expect(observations).toHaveLength(0);
    });
  });

  describe("missingFaviconRule", () => {
    it("returns observation when favicon is missing", () => {
      const capture = makeCapture({ html: "<html><head></head></html>" });
      const observations = missingFaviconRule(capture);
      expect(observations).toHaveLength(1);
      expect(observations[0]?.description).toContain("favicon");
    });

    it("returns empty when favicon is present", () => {
      const capture = makeCapture();
      const observations = missingFaviconRule(capture);
      expect(observations).toHaveLength(0);
    });
  });

  describe("excessivePageWeightRule", () => {
    it("returns observation when page is too heavy", () => {
      const capture = makeCapture({ transferSize: 11 * 1024 * 1024 });
      const observations = excessivePageWeightRule(capture);
      expect(observations).toHaveLength(1);
      expect(observations[0]?.description).toContain("Page weight");
    });

    it("returns empty when page is within limits", () => {
      const capture = makeCapture({ transferSize: 1024 });
      const observations = excessivePageWeightRule(capture);
      expect(observations).toHaveLength(0);
    });
  });

  describe("runObservationRules", () => {
    it("runs all rules and returns observations", () => {
      const capture = makeCapture({ url: "http://example.com" });
      const observations = runObservationRules(capture);
      expect(observations.length).toBeGreaterThan(0);
    });

    it("all observations have observed certainty", () => {
      const capture = makeCapture();
      const observations = runObservationRules(capture);
      for (const obs of observations) {
        expect(obs.certainty).toBe("observed");
      }
    });

    it("returns empty for a perfect page", () => {
      const capture = makeCapture();
      const observations = runObservationRules(capture);
      expect(observations).toHaveLength(0);
    });
  });
});
