import { describe, expect, it } from "vitest";

import { CONVENTIONAL_PATHS } from "@mela/config";
import { buildFetchUrls, isUrlAllowed } from "./page-fetcher";

describe("page-fetcher", () => {
  describe("buildFetchUrls", () => {
    it("combines analysed URLs with conventional paths", () => {
      const analysedUrls = ["https://example.com/about"];
      const baseUrl = "https://example.com";

      const urls = buildFetchUrls(analysedUrls, baseUrl);

      // Should include the analysed URL
      expect(urls).toContain("https://example.com/about");

      // Should include conventional paths
      for (const path of CONVENTIONAL_PATHS) {
        expect(urls).toContain(`https://example.com${path}`);
      }
    });

    it("deduplicates URLs", () => {
      // /about is both analysed and a conventional path
      const analysedUrls = ["https://example.com/about"];
      const baseUrl = "https://example.com";

      const urls = buildFetchUrls(analysedUrls, baseUrl);

      // Count how many times /about appears
      const aboutCount = urls.filter((u) => u.endsWith("/about")).length;
      expect(aboutCount).toBe(1);
    });

    it("respects max pages limit", () => {
      const analysedUrls = Array.from({ length: 30 }, (_, i) => `https://example.com/page${i}`);
      const baseUrl = "https://example.com";

      const urls = buildFetchUrls(analysedUrls, baseUrl);

      // Should not exceed maxPages (20)
      expect(urls.length).toBeLessThanOrEqual(20);
    });

    it("handles empty analysed URLs", () => {
      const analysedUrls: string[] = [];
      const baseUrl = "https://example.com";

      const urls = buildFetchUrls(analysedUrls, baseUrl);

      // Should still include conventional paths
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.length).toBe(CONVENTIONAL_PATHS.length);
    });
  });

  describe("isUrlAllowed", () => {
    it("returns true for any URL (placeholder)", () => {
      expect(isUrlAllowed("https://example.com", "MelaBot/1.0")).toBe(true);
    });
  });
});
