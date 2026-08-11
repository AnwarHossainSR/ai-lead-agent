import { describe, expect, it } from "vitest";

import { CANDIDATE_REJECTION_REASONS, validateCandidate } from "./source";

describe("a candidate with a source", () => {
  it("is accepted when it carries a source URL", () => {
    const result = validateCandidate({
      name: "Example Trading L.L.C.",
      sourceUrl: "https://import.example/list.csv",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.candidate.name).toBe("Example Trading L.L.C.");
      expect(result.candidate.sourceUrl).toBe("https://import.example/list.csv");
    }
  });
});

describe("a candidate without a source URL", () => {
  it("is rejected with a reason naming the missing field", () => {
    const result = validateCandidate({ name: "Example Trading L.L.C." });

    expect(result).toEqual({ ok: false, reason: CANDIDATE_REJECTION_REASONS.missing_source_url });
  });

  it("is rejected when the source URL is blank", () => {
    const result = validateCandidate({ name: "Example Trading L.L.C.", sourceUrl: "   " });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(CANDIDATE_REJECTION_REASONS.missing_source_url);
    }
  });

  it("is rejected when the source URL is not a URL", () => {
    const result = validateCandidate({ name: "Example", sourceUrl: "not a url" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(CANDIDATE_REJECTION_REASONS.invalid_candidate);
    }
  });
});

describe("omitted attributes", () => {
  it("stay absent rather than being filled with an estimate", () => {
    const result = validateCandidate({
      name: "Example Trading L.L.C.",
      sourceUrl: "https://import.example/list.csv",
    });

    if (result.ok) {
      expect(result.candidate.website).toBeUndefined();
      expect(result.candidate.city).toBeUndefined();
      expect(result.candidate.companySize).toBeUndefined();
      expect(result.candidate.linkedinUrl).toBeUndefined();
      expect(result.candidate.description).toBeUndefined();
    }
  });

  it("treat a blank or null optional value as absent", () => {
    const result = validateCandidate({
      name: "Example Trading L.L.C.",
      sourceUrl: "https://import.example/list.csv",
      website: "",
      companySize: null,
    });

    if (result.ok) {
      expect(result.candidate.website).toBeUndefined();
      expect(result.candidate.companySize).toBeUndefined();
    }
  });

  it("refuse a blank company name", () => {
    const result = validateCandidate({
      name: "   ",
      sourceUrl: "https://import.example/list.csv",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(CANDIDATE_REJECTION_REASONS.invalid_candidate);
    }
  });
});

describe("no URL is invented", () => {
  it("never constructs a website for a candidate that supplied none", () => {
    const result = validateCandidate({
      name: "Example Trading L.L.C.",
      sourceUrl: "https://import.example/list.csv",
    });

    if (result.ok) {
      expect(result.candidate.website).toBeUndefined();
    }
  });

  it("never substitutes a guessed URL for a missing source URL", () => {
    const result = validateCandidate({ name: "Example Trading L.L.C." });

    expect(result.ok).toBe(false);
  });
});
