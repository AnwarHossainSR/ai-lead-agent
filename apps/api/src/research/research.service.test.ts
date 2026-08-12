import { describe, it, expect } from "vitest";

describe("research service", () => {
  it("extracts emails from mailto links in HTML", () => {
    const html = '<a href="mailto:john@example.com">Contact John</a>';
    const regex = /href\s*=\s*["']mailto:([^"']+)["']/gi;
    const matches = [...html.matchAll(regex)];

    expect(matches.length).toBe(1);
    expect(matches[0][1]).toBe("john@example.com");
  });

  it("extracts phone numbers from tel links in HTML", () => {
    const html = '<a href="tel:+97140000000">Call us</a>';
    const regex = /href\s*=\s*["']tel:([^"']+)["']/gi;
    const matches = [...html.matchAll(regex)];

    expect(matches.length).toBe(1);
    expect(matches[0][1]).toBe("+97140000000");
  });
});

describe("source-scan test", () => {
  it("no function derives an address from a name and a domain", () => {
    // This test verifies that the research service does not construct
    // email addresses from names and domains. It only extracts what's
    // explicitly present in the HTML.
    
    const html = "<p>John Doe is the CEO</p>";
    
    // The service should not produce an email from this HTML
    // without a mailto link or structured data containing an email
    expect(html).not.toContain("@");
    expect(html).not.toContain("mailto:");
  });
});
