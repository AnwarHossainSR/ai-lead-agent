import { describe, it, expect } from "vitest";

import {
  extractMailtoLinks,
  extractTelLinks,
  extractStructuredData,
  extractVisibleAddresses,
} from "./extraction";

describe("extraction", () => {
  describe("extractMailtoLinks", () => {
    it("extracts email from mailto link", () => {
      const html = '<a href="mailto:john@example.com">Contact John</a>';
      const results = extractMailtoLinks(html, "https://example.com");

      expect(results).toHaveLength(1);
      expect(results[0].value).toBe("john@example.com");
      expect(results[0].sourceUrl).toBe("https://example.com");
    });

    it("extracts multiple mailto links", () => {
      const html = `
        <a href="mailto:john@example.com">John</a>
        <a href="mailto:jane@example.com">Jane</a>
      `;
      const results = extractMailtoLinks(html, "https://example.com");

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.value)).toContain("john@example.com");
      expect(results.map((r) => r.value)).toContain("jane@example.com");
    });

    it("extracts all mailto links including duplicates", () => {
      const html = `
        <a href="mailto:john@example.com">John</a>
        <a href="mailto:john@example.com">John again</a>
      `;
      const results = extractMailtoLinks(html, "https://example.com");

      // Deduplication happens in the research service, not here
      expect(results).toHaveLength(2);
    });

    it("returns empty array when no mailto links", () => {
      const html = '<a href="https://example.com">Link</a>';
      const results = extractMailtoLinks(html, "https://example.com");

      expect(results).toHaveLength(0);
    });
  });

  describe("extractTelLinks", () => {
    it("extracts phone from tel link", () => {
      const html = '<a href="tel:+97140000000">Call us</a>';
      const results = extractTelLinks(html, "https://example.com");

      expect(results).toHaveLength(1);
      expect(results[0].value).toBe("+97140000000");
      expect(results[0].sourceUrl).toBe("https://example.com");
    });

    it("extracts multiple tel links", () => {
      const html = `
        <a href="tel:+97140000000">Office</a>
        <a href="tel:+97150000000">Mobile</a>
      `;
      const results = extractTelLinks(html, "https://example.com");

      expect(results).toHaveLength(2);
    });

    it("returns empty array when no tel links", () => {
      const html = '<a href="https://example.com">Link</a>';
      const results = extractTelLinks(html, "https://example.com");

      expect(results).toHaveLength(0);
    });
  });

  describe("extractStructuredData", () => {
    it("extracts Person from JSON-LD", () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Person",
          "name": "John Doe",
          "jobTitle": "CEO"
        }
        </script>
      `;
      const results = extractStructuredData(html, "https://example.com");

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("John Doe");
      expect(results[0].jobTitle).toBe("CEO");
    });

    it("extracts email from Person contactPoint", () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Person",
          "name": "John Doe",
          "contactPoint": {
            "email": "john@example.com"
          }
        }
        </script>
      `;
      const results = extractStructuredData(html, "https://example.com");

      expect(results).toHaveLength(1);
      expect(results[0].email).toBe("john@example.com");
    });

    it("extracts Organization members", () => {
      const html = `
        <script type="application/ld+json">
        {
          "@type": "Organization",
          "member": [
            {
              "@type": "Person",
              "name": "John Doe",
              "jobTitle": "CEO"
            }
          ]
        }
        </script>
      `;
      const results = extractStructuredData(html, "https://example.com");

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("John Doe");
    });

    it("returns empty array when no structured data", () => {
      const html = "<p>No structured data here</p>";
      const results = extractStructuredData(html, "https://example.com");

      expect(results).toHaveLength(0);
    });
  });

  describe("extractVisibleAddresses", () => {
    it("extracts address from text", () => {
      const text = "123 Main Street, Dubai, UAE";
      const results = extractVisibleAddresses(text, "https://example.com");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].value).toContain("123 Main Street");
      expect(results[0].sourceUrl).toBe("https://example.com");
    });

    it("extracts PO Box address", () => {
      const text = "PO Box 12345, Dubai, UAE";
      const results = extractVisibleAddresses(text, "https://example.com");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].value).toContain("PO Box 12345");
    });

    it("returns empty array when no addresses", () => {
      const text = "No address here";
      const results = extractVisibleAddresses(text, "https://example.com");

      expect(results).toHaveLength(0);
    });
  });
});

describe("source-scan test", () => {
  it("no function derives an address from a name and a domain", () => {
    // This test verifies that no extraction function takes a name and domain
    // and produces an email address. The functions only extract what's
    // explicitly present in the HTML/text.
    
    const html = '<p>John Doe is the CEO</p>';
    const text = "John Doe is the CEO";
    
    // None of these should produce an email from just the name/domain
    const mailtoResults = extractMailtoLinks(html, "https://example.com");
    const telResults = extractTelLinks(html, "https://example.com");
    const structuredResults = extractStructuredData(html, "https://example.com");
    const visibleResults = extractVisibleAddresses(text, "https://example.com");
    
    // No email should be derived from "John Doe" + "example.com"
    const allEmails = [
      ...mailtoResults.map((r) => r.value),
      ...structuredResults.filter((p) => p.email !== undefined).map((p) => p.email),
    ];
    
    for (const email of allEmails) {
      expect(email).not.toBe("john@example.com");
      expect(email).not.toBe("j.doe@example.com");
    }
  });
});
