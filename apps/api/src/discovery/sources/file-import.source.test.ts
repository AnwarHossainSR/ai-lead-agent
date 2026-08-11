import { describe, expect, it } from "vitest";

import { CANDIDATE_REJECTION_REASONS } from "./source";
import {
  FILE_IMPORT_REJECTION_REASONS,
  FileImportSource,
  parseCsvLine,
  parseRows,
} from "./file-import.source";

function sourceWith(content: string): FileImportSource {
  return new FileImportSource("companies.csv", async () => content);
}

describe("the file-import source reads a CSV list", () => {
  it("returns every valid row as a candidate", async () => {
    const source = sourceWith(
      [
        "name,sourceUrl,website,city,companySize",
        "Example Trading L.L.C.,https://import.example/row/1,https://example.ae,dubai,50-200",
        "Another Company,https://import.example/row/2,,,,",
      ].join("\n"),
    );

    const result = await source.fetch({ countryId: "uae", industryId: "logistics" });

    expect(result.outcome).toBe("succeeded");
    if (result.outcome === "succeeded") {
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[0]).toMatchObject({
        name: "Example Trading L.L.C.",
        website: "https://example.ae",
        city: "dubai",
        companySize: "50-200",
      });
      expect(result.candidates[1]!.website).toBeUndefined();
    }
  });

  it("handles quoted cells containing commas", async () => {
    const line = '"Example, Trading",https://import.example/row/1';
    expect(parseCsvLine(line)).toEqual(["Example, Trading", "https://import.example/row/1"]);
  });

  it("handles escaped quotes inside a quoted cell", async () => {
    const line = '"They said ""hello""",https://import.example/row/1';
    expect(parseCsvLine(line)).toEqual(['They said "hello"', "https://import.example/row/1"]);
  });

  it("is decided by content, not by the file name", () => {
    expect(parseRows("[{ \"name\": \"x\" }]")).toEqual([{ name: "x" }]);
    expect(parseRows("name,sourceUrl\nX,https://a.example/1")).toHaveLength(1);
  });
});

describe("the file-import source reads a JSON list", () => {
  it("returns every valid entry as a candidate", async () => {
    const source = sourceWith(
      JSON.stringify([
        {
          name: "Example Trading L.L.C.",
          sourceUrl: "https://import.example/row/1",
          website: "https://example.ae",
        },
        { name: "Another Company", sourceUrl: "https://import.example/row/2" },
      ]),
    );

    const result = await source.fetch({ countryId: "uae", industryId: "logistics" });

    expect(result.outcome).toBe("succeeded");
    if (result.outcome === "succeeded") {
      expect(result.candidates).toHaveLength(2);
      expect(result.candidates[1]!.website).toBeUndefined();
    }
  });
});

describe("the file-import source rejects invalid rows by reason", () => {
  it("counts candidates missing a source URL separately", async () => {
    const source = sourceWith(
      [
        "name,sourceUrl",
        "With A Source,https://import.example/row/1",
        "Without A Source,",
      ].join("\n"),
    );

    const result = await source.fetch({ countryId: "uae", industryId: "logistics" });

    expect(result.outcome).toBe("succeeded");
    if (result.outcome === "succeeded") {
      expect(result.candidates).toHaveLength(1);
      expect(result.rejections).toEqual([
        { reason: CANDIDATE_REJECTION_REASONS.missing_source_url, count: 1 },
      ]);
    }
  });

  it("counts rows that are not candidates as invalid", async () => {
    const source = sourceWith(
      JSON.stringify([{ name: "Fine", sourceUrl: "https://import.example/row/1" }, 42]),
    );

    const result = await source.fetch({ countryId: "uae", industryId: "logistics" });

    expect(result.outcome).toBe("succeeded");
    if (result.outcome === "succeeded") {
      expect(result.candidates).toHaveLength(1);
      expect(result.rejections).toEqual([
        { reason: CANDIDATE_REJECTION_REASONS.invalid_candidate, count: 1 },
      ]);
    }
  });
});

describe("the file-import source fails on an unreadable or malformed file", () => {
  it("reports an unreadable file as a failure", async () => {
    const source = new FileImportSource("missing.csv", async () => {
      throw new Error("ENOENT");
    });

    const result = await source.fetch({ countryId: "uae", industryId: "logistics" });

    expect(result).toEqual({
      outcome: "failed",
      reason: FILE_IMPORT_REJECTION_REASONS.unreadable_file,
    });
  });

  it("reports malformed JSON as a failure", async () => {
    const source = sourceWith("{ not json");

    const result = await source.fetch({ countryId: "uae", industryId: "logistics" });

    expect(result).toEqual({
      outcome: "failed",
      reason: FILE_IMPORT_REJECTION_REASONS.malformed_file,
    });
  });

  it("reports a JSON value that is not an array as a failure", async () => {
    const source = sourceWith('{ "name": "Not an array" }');

    const result = await source.fetch({ countryId: "uae", industryId: "logistics" });

    expect(result.outcome).toBe("failed");
  });
});

describe("an empty file", () => {
  it("is an empty success, not a failure", async () => {
    const source = sourceWith("name,sourceUrl\n");

    const result = await source.fetch({ countryId: "uae", industryId: "logistics" });

    expect(result).toEqual({ outcome: "succeeded", candidates: [], rejections: [] });
  });
});
