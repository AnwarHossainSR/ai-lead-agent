import { describe, expect, it } from "vitest";

import {
  parseFingerprints,
  resolveFingerprint,
  TECHNOLOGY_CATEGORIES,
  type Fingerprint,
} from "./fingerprints";

describe("technology fingerprints", () => {
  describe("TECHNOLOGY_CATEGORIES", () => {
    it("contains expected categories", () => {
      expect(TECHNOLOGY_CATEGORIES).toContain("cms");
      expect(TECHNOLOGY_CATEGORIES).toContain("ecommerce");
      expect(TECHNOLOGY_CATEGORIES).toContain("framework");
      expect(TECHNOLOGY_CATEGORIES).toContain("analytics");
      expect(TECHNOLOGY_CATEGORIES).toContain("cdn");
      expect(TECHNOLOGY_CATEGORIES).toContain("hosting");
    });
  });

  describe("parseFingerprints", () => {
    it("accepts valid fingerprints", () => {
      const fingerprints: Fingerprint[] = [
        {
          id: "wordpress",
          technology: "WordPress",
          category: "cms",
          patterns: [
            { in: "html", match: "wp-content" },
          ],
          implies: [],
        },
      ];

      const result = parseFingerprints(fingerprints);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("wordpress");
    });

    it("rejects duplicate identifiers", () => {
      const fingerprints: Fingerprint[] = [
        {
          id: "wordpress",
          technology: "WordPress",
          category: "cms",
          patterns: [{ in: "html", match: "wp-content" }],
          implies: [],
        },
        {
          id: "wordpress",
          technology: "WordPress Duplicate",
          category: "cms",
          patterns: [{ in: "html", match: "wp-content" }],
          implies: [],
        },
      ];

      expect(() => parseFingerprints(fingerprints)).toThrow("Duplicate fingerprint identifier: wordpress");
    });

    it("rejects fingerprints with no patterns", () => {
      const fingerprints = [
        {
          id: "no-patterns",
          technology: "No Patterns",
          category: "cms",
          patterns: [],
          implies: [],
        },
      ];

      expect(() => parseFingerprints(fingerprints)).toThrow();
    });

    it("rejects invalid regex patterns", () => {
      const fingerprints = [
        {
          id: "invalid-regex",
          technology: "Invalid Regex",
          category: "cms",
          patterns: [
            { in: "html", match: "[invalid" },
          ],
          implies: [],
        },
      ];

      expect(() => parseFingerprints(fingerprints)).toThrow();
    });

    it("rejects unknown categories", () => {
      const fingerprints = [
        {
          id: "unknown-cat",
          technology: "Unknown Category",
          category: "nonexistent",
          patterns: [{ in: "html", match: "test" }],
          implies: [],
        },
      ];

      expect(() => parseFingerprints(fingerprints)).toThrow();
    });

    it("rejects implication cycles", () => {
      const fingerprints: Fingerprint[] = [
        {
          id: "a",
          technology: "A",
          category: "cms",
          patterns: [{ in: "html", match: "a" }],
          implies: ["b"],
        },
        {
          id: "b",
          technology: "B",
          category: "cms",
          patterns: [{ in: "html", match: "b" }],
          implies: ["a"],
        },
      ];

      expect(() => parseFingerprints(fingerprints)).toThrow("Implication cycle detected");
    });

    it("rejects patterns with catastrophic backtracking", () => {
      const fingerprints: Fingerprint[] = [
        {
          id: "backtrack",
          technology: "Backtrack",
          category: "cms",
          patterns: [
            { in: "html", match: "(a+)+b" },
          ],
          implies: [],
        },
      ];

      expect(() => parseFingerprints(fingerprints)).toThrow("Fingerprint 'backtrack' has pattern with potential catastrophic backtracking");
    });

    it("accepts fingerprints with version capture groups", () => {
      const fingerprints: Fingerprint[] = [
        {
          id: "with-version",
          technology: "With Version",
          category: "cms",
          patterns: [
            { in: "html", match: "version ([\\d.]+)", version: 1 },
          ],
          implies: [],
        },
      ];

      const result = parseFingerprints(fingerprints);
      expect(result).toHaveLength(1);
      expect(result[0]?.patterns[0]?.version).toBe(1);
    });
  });

  describe("resolveFingerprint", () => {
    const fingerprints: Fingerprint[] = [
      {
        id: "wordpress",
        technology: "WordPress",
        category: "cms",
        patterns: [{ in: "html", match: "wp-content" }],
        implies: [],
      },
      {
        id: "woocommerce",
        technology: "WooCommerce",
        category: "ecommerce",
        patterns: [{ in: "html", match: "woocommerce" }],
        implies: ["wordpress"],
      },
    ];

    it("resolves an existing fingerprint", () => {
      const result = resolveFingerprint(fingerprints, "wordpress");
      expect(result).toBeDefined();
      expect(result?.id).toBe("wordpress");
      expect(result?.technology).toBe("WordPress");
    });

    it("throws for unknown fingerprint", () => {
      expect(() => resolveFingerprint(fingerprints, "unknown")).toThrow(
        "Unknown fingerprint: unknown. Configured fingerprints: wordpress, woocommerce",
      );
    });
  });
});
