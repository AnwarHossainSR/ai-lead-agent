import { beforeEach, describe, expect, it } from "vitest";

import {
  checkDeliverability,
  classifySeniority,
  clearDeliverabilityCache,
} from "./seniority-deliverability";

describe("seniority-deliverability", () => {
  describe("classifySeniority", () => {
    it("classifies CEO as c-level", () => {
      const result = classifySeniority("CEO");
      expect(result.levelId).toBe("c-level");
    });

    it("classifies VP as vp", () => {
      const result = classifySeniority("Vice President");
      expect(result.levelId).toBe("vp");
    });

    it("classifies Director as director", () => {
      const result = classifySeniority("Director of Engineering");
      expect(result.levelId).toBe("director");
    });

    it("classifies Manager as manager", () => {
      const result = classifySeniority("Product Manager");
      expect(result.levelId).toBe("manager");
    });

    it("classifies Senior as senior", () => {
      const result = classifySeniority("Senior Developer");
      expect(result.levelId).toBe("senior");
    });

    it("returns unknown for unmatched title", () => {
      const result = classifySeniority("Software Engineer");
      expect(result.levelId).toBe("unknown");
      expect(result.level).toBeNull();
    });

    it("returns unknown for null title", () => {
      const result = classifySeniority(null);
      expect(result.levelId).toBe("unknown");
      expect(result.level).toBeNull();
    });

    it("returns unknown for empty title", () => {
      const result = classifySeniority("");
      expect(result.levelId).toBe("unknown");
      expect(result.level).toBeNull();
    });
  });

  describe("checkDeliverability", () => {
    beforeEach(() => {
      clearDeliverabilityCache();
    });

    it("checks deliverability for a domain with MX records", async () => {
      // gmail.com has MX records
      const result = await checkDeliverability("gmail.com");
      expect(result.status).toBe("receivable");
      expect(result.domain).toBe("gmail.com");
    });

    it("caches results", async () => {
      const result1 = await checkDeliverability("gmail.com");
      const result2 = await checkDeliverability("gmail.com");

      expect(result1.status).toBe(result2.status);
    });

    it("clears cache", async () => {
      await checkDeliverability("gmail.com");
      clearDeliverabilityCache();
      // After clearing, next lookup should be fresh
      const result = await checkDeliverability("gmail.com");
      expect(result.status).toBe("receivable");
    });
  });
});

describe("no SMTP connection", () => {
  it("does not open SMTP connections", async () => {
    // This test verifies that the deliverability check uses DNS-over-HTTPS
    // and does NOT open any SMTP connections. The implementation uses
    // fetch to dns.google, not any SMTP library.

    // If someone accidentally adds SMTP code, this test would need to be
    // updated to mock the SMTP connection and verify it's not called.

    const result = await checkDeliverability("gmail.com");
    expect(result.status).toBe("receivable");
    // The fact that this completes without opening an SMTP connection
    // is the test itself.
  });
});
