import { describe, expect, it } from "vitest";

import { normalizeDomain } from "./normalize-domain";

describe("the same site in different forms", () => {
  it("resolves to one domain", () => {
    const forms = [
      "https://WWW.Example.ae/about?x=1",
      "http://example.ae",
      "https://example.ae:443/",
    ];

    expect(forms.map(normalizeDomain)).toEqual(["example.ae", "example.ae", "example.ae"]);
  });

  it("strips path, query and fragment", () => {
    expect(normalizeDomain("https://example.ae/en/services?utm=x#contact")).toBe("example.ae");
  });

  it("strips a non-default port", () => {
    expect(normalizeDomain("http://example.ae:8080/")).toBe("example.ae");
  });

  it("accepts a bare host with no scheme", () => {
    expect(normalizeDomain("example.ae")).toBe("example.ae");
  });

  it("accepts a scheme-relative form", () => {
    expect(normalizeDomain("//example.ae/about")).toBe("example.ae");
  });

  it("ignores surrounding whitespace", () => {
    expect(normalizeDomain("  https://example.ae  ")).toBe("example.ae");
  });
});

describe("a subdomain", () => {
  it("is preserved, because it is a different site", () => {
    expect(normalizeDomain("https://shop.example.ae")).toBe("shop.example.ae");
  });

  it("loses only a leading www", () => {
    expect(normalizeDomain("https://www.shop.example.ae")).toBe("shop.example.ae");
  });

  it("keeps www when stripping it would leave no registrable domain", () => {
    expect(normalizeDomain("https://www.com")).toBe("www.com");
  });

  it("keeps a www that is not the leading label", () => {
    expect(normalizeDomain("https://www.www.example.ae")).toBe("www.example.ae");
  });
});

describe("a trailing root dot", () => {
  it("is removed so the fully qualified form matches the ordinary one", () => {
    expect(normalizeDomain("https://example.ae./about")).toBe("example.ae");
    expect(normalizeDomain("example.ae.")).toBe("example.ae");
  });
});

describe("an internationalized domain", () => {
  it("normalizes to its punycode form", () => {
    expect(normalizeDomain("https://مثال.إمارات")).toBe("xn--mgbh0fb.xn--kgbeam7a8h");
  });

  it("produces the same value whichever form was supplied", () => {
    expect(normalizeDomain("https://مثال.إمارات")).toBe(
      normalizeDomain("https://XN--MGBH0FB.XN--KGBEAM7A8H"),
    );
  });
});

describe("input that is not a registrable domain", () => {
  it.each([
    ["absent", undefined],
    ["null", null],
    ["empty", ""],
    ["whitespace", "   "],
    ["unparseable", "not a url"],
    ["a scheme with no host", "https://"],
    ["a mailto address", "mailto:hello@example.ae"],
    ["a bare host with no public suffix", "localhost"],
    ["an IPv4 literal", "http://192.168.1.1"],
    ["an IPv6 literal", "http://[::1]/"],
    ["a numeric top-level label", "http://example.123"],
    ["an empty label", "http://example..ae"],
  ])("returns null for %s", (_case, input) => {
    expect(normalizeDomain(input)).toBeNull();
  });
});

describe("determinism", () => {
  it("is idempotent — normalizing a normalized domain changes nothing", () => {
    const once = normalizeDomain("https://WWW.Example.ae:443/about?x=1");

    expect(once).not.toBeNull();
    expect(normalizeDomain(once)).toBe(once);
  });
});
