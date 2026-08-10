import { describe, expect, it } from "vitest";

import { LEGAL_SUFFIXES, normalizeCompanyName } from "./normalize-company-name";

describe("legal suffixes", () => {
  it("do not create distinct normalized names", () => {
    expect(normalizeCompanyName("Example Trading L.L.C.")).toBe(
      normalizeCompanyName("example trading llc"),
    );
  });

  it("are stripped from the end of the name", () => {
    expect(normalizeCompanyName("Example Trading L.L.C.")).toBe("example trading");
  });

  it.each([
    ["Gulf Logistics LLC", "gulf logistics"],
    ["Gulf Logistics L.L.C.", "gulf logistics"],
    ["Gulf Logistics FZE", "gulf logistics"],
    ["Gulf Logistics FZ-LLC", "gulf logistics"],
    ["Gulf Logistics LLC-FZ", "gulf logistics"],
    ["Gulf Logistics Ltd", "gulf logistics"],
    ["Gulf Logistics Limited", "gulf logistics"],
    ["Gulf Logistics W.L.L.", "gulf logistics"],
    ["Gulf Logistics PJSC", "gulf logistics"],
  ])("reduces %s to %s", (input, expected) => {
    expect(normalizeCompanyName(input)).toBe(expected);
  });

  it("strips more than one where a name carries more than one", () => {
    expect(normalizeCompanyName("Gulf Logistics Limited LLC")).toBe("gulf logistics");
  });

  it("are only stripped at the end, never inside the name", () => {
    expect(normalizeCompanyName("Limited Edition Interiors")).toBe("limited edition interiors");
  });

  it("leave the name alone when it consists of nothing else", () => {
    expect(normalizeCompanyName("LLC")).toBe("llc");
  });

  it("are declared as data so the list can grow without touching the algorithm", () => {
    expect(LEGAL_SUFFIXES).toContain("pjsc");
  });
});

describe("folding", () => {
  it("lowercases", () => {
    expect(normalizeCompanyName("EMAAR PROPERTIES")).toBe("emaar properties");
  });

  it("collapses runs of whitespace, including tabs and newlines", () => {
    expect(normalizeCompanyName("  Al   Faris \t Group \n ")).toBe("al faris group");
  });

  it("removes punctuation that joins its neighbours", () => {
    expect(normalizeCompanyName("O'Brien & Sons")).toBe("obrien sons");
  });

  it("treats other punctuation as a separator", () => {
    expect(normalizeCompanyName("Al-Faris/Group, Inc")).toBe("al faris group inc");
  });

  it("keeps digits, which are part of some names", () => {
    expect(normalizeCompanyName("Studio 55 Interiors")).toBe("studio 55 interiors");
  });

  it("keeps non-Latin scripts instead of erasing the name", () => {
    expect(normalizeCompanyName("شركة الفارس ذ.م.م")).toBe("شركة الفارس ذمم");
  });
});

describe("input with no name", () => {
  it.each([
    ["absent", undefined],
    ["null", null],
    ["empty", ""],
    ["whitespace", "   "],
    ["punctuation only", "--- ... ---"],
  ])("returns null for %s", (_case, input) => {
    expect(normalizeCompanyName(input)).toBeNull();
  });
});

describe("determinism", () => {
  it("is idempotent — normalizing a normalized name changes nothing", () => {
    const once = normalizeCompanyName("Example Trading L.L.C.");

    expect(once).not.toBeNull();
    expect(normalizeCompanyName(once)).toBe(once);
  });
});
