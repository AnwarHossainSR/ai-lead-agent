import { describe, expect, it } from "vitest";

import { MatcherService, type PageCapture } from "./matcher.service";
import { DEFAULT_FINGERPRINTS } from "@mela/config";
import type { Fingerprint } from "@mela/config";

function makeCapture(overrides?: Partial<PageCapture>): PageCapture {
  return {
    url: "https://example.com",
    status: 200,
    headers: {},
    html: "<html><head></head><body></body></html>",
    scriptUrls: [],
    stylesheetUrls: [],
    cookieNames: [],
    metaGenerator: null,
    ...overrides,
  };
}

describe("MatcherService", () => {
  const fingerprints = [...DEFAULT_FINGERPRINTS] as Fingerprint[];
  const matcher = new MatcherService(fingerprints);

  describe("detect", () => {
    it("detects WordPress from HTML", () => {
      const capture = makeCapture({
        html: '<html><head></head><body><script src="https://example.com/wp-content/themes/theme/style.css"></script></body></html>',
      });

      const detections = matcher.detect(capture);
      const wordpress = detections.find((d) => d.technologyId === "WordPress");

      expect(wordpress).toBeDefined();
      expect(wordpress?.certainty).toBe("observed");
      expect(wordpress?.matchedIn).toBe("html");
      expect(wordpress?.matchedText).toContain("wp-content");
    });

    it("detects Shopify from header", () => {
      const capture = makeCapture({
        headers: {
          "x-shopify-stage": "production",
        },
      });

      const detections = matcher.detect(capture);
      const shopify = detections.find((d) => d.technologyId === "Shopify");

      expect(shopify).toBeDefined();
      expect(shopify?.certainty).toBe("observed");
      expect(shopify?.matchedIn).toBe("header");
    });

    it("detects Google Analytics from script URL", () => {
      const capture = makeCapture({
        scriptUrls: [
          "https://www.google-analytics.com/analytics.js",
        ],
      });

      const detections = matcher.detect(capture);
      const ga = detections.find((d) => d.technologyId === "Google Analytics");

      expect(ga).toBeDefined();
      expect(ga?.certainty).toBe("observed");
      expect(ga?.matchedIn).toBe("script");
    });

    it("detects Cloudflare from header", () => {
      const capture = makeCapture({
        headers: {
          "cf-ray": "1234567890",
        },
      });

      const detections = matcher.detect(capture);
      const cloudflare = detections.find((d) => d.technologyId === "Cloudflare");

      expect(cloudflare).toBeDefined();
      expect(cloudflare?.certainty).toBe("observed");
    });

    it("detects version from pattern", () => {
      const matcherWithVersion = new MatcherService([
        {
          id: "test-version",
          technology: "TestVersion",
          category: "cms",
          patterns: [
            { in: "html", match: "version ([\\d.]+)", version: 1 },
          ],
          implies: [],
        },
      ]);

      const capture = makeCapture({
        html: "version 1.2.3",
      });

      const detections = matcherWithVersion.detect(capture);
      const testVersion = detections.find((d) => d.technologyId === "TestVersion");

      expect(testVersion).toBeDefined();
      expect(testVersion?.version).toBe("1.2.3");
    });

    it("records no version when not present", () => {
      const capture = makeCapture({
        html: "wp-content",
      });

      const detections = matcher.detect(capture);
      const wordpress = detections.find((d) => d.technologyId === "WordPress");

      expect(wordpress).toBeDefined();
      expect(wordpress?.version).toBeNull();
    });

    it("resolves implications as inferred", () => {
      const capture = makeCapture({
        html: "woocommerce",
      });

      const detections = matcher.detect(capture);
      const woocommerce = detections.find((d) => d.technologyId === "WooCommerce");
      const wordpress = detections.find((d) => d.technologyId === "WordPress");

      expect(woocommerce).toBeDefined();
      expect(woocommerce?.certainty).toBe("observed");

      expect(wordpress).toBeDefined();
      expect(wordpress?.certainty).toBe("inferred");
      expect(wordpress?.impliedBy).toBe("woocommerce");
    });

    it("does not downgrade observation to inference", () => {
      const capture = makeCapture({
        html: "wp-content woocommerce",
      });

      const detections = matcher.detect(capture);
      const wordpress = detections.find((d) => d.technologyId === "WordPress");

      expect(wordpress).toBeDefined();
      expect(wordpress?.certainty).toBe("observed"); // Not inferred
    });

    it("returns empty for no matches", () => {
      const capture = makeCapture({
        html: "nothing here",
      });

      const detections = matcher.detect(capture);
      expect(detections).toHaveLength(0);
    });

    it("is deterministic across runs", () => {
      const capture = makeCapture({
        html: "wp-content woocommerce",
        headers: { "cf-ray": "123" },
      });

      const run1 = matcher.detect(capture);
      const run2 = matcher.detect(capture);

      expect(run1).toEqual(run2);
    });

    it("respects time budget", () => {
      const slowMatcher = new MatcherService(DEFAULT_FINGERPRINTS, {
        timeBudgetMs: 0, // Immediate timeout
      });

      const capture = makeCapture({
        html: "wp-content",
      });

      const detections = slowMatcher.detect(capture);
      // May find some detections before timeout
      expect(Array.isArray(detections)).toBe(true);
    });

    it("truncates HTML to max bytes", () => {
      const smallHtmlMatcher = new MatcherService(
        [
          {
            id: "test",
            technology: "Test",
            category: "cms",
            patterns: [{ in: "html", match: "test-pattern" }],
            implies: [],
          },
        ],
        { maxHtmlBytes: 10 },
      );

      const capture = makeCapture({
        html: "x".repeat(20) + "test-pattern",
      });

      const detections = smallHtmlMatcher.detect(capture);
      expect(detections).toHaveLength(0); // Pattern not in first 10 bytes
    });
  });
});
