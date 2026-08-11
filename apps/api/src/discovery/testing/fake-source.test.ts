import { describe, expect, it } from "vitest";

import { FakeDiscoverySource, fakeBlockedSource, fakeFailedSource, fakeSucceededSource } from "./fake-source";

describe("the fake discovery source", () => {
  it("returns the candidates it was given", async () => {
    const source = fakeSucceededSource("file_import", [
      { name: "Example Trading L.L.C.", sourceUrl: "https://import.example/row/1" },
    ]);

    const result = await source.fetch({ countryId: "uae", industryId: "logistics" });

    expect(result).toEqual({
      outcome: "succeeded",
      candidates: [
        { name: "Example Trading L.L.C.", sourceUrl: "https://import.example/row/1" },
      ],
      rejections: [],
    });
  });

  it("returns an empty result when constructed with no candidates", async () => {
    const source = fakeSucceededSource("file_import");

    const result = await source.fetch({ countryId: "uae", industryId: "logistics" });

    expect(result.outcome).toBe("succeeded");
    if (result.outcome === "succeeded") {
      expect(result.candidates).toHaveLength(0);
    }
  });

  it("returns a block", async () => {
    const source = fakeBlockedSource("business_directory");

    const result = await source.fetch({ countryId: "uae", industryId: "logistics" });

    expect(result).toEqual({ outcome: "blocked", note: "blocked by host" });
  });

  it("returns a failure", async () => {
    const source = fakeFailedSource("places");

    const result = await source.fetch({ countryId: "uae", industryId: "logistics" });

    expect(result).toEqual({ outcome: "failed", reason: "provider error" });
  });

  it("records the requests it received", async () => {
    const source = fakeSucceededSource("file_import");
    const request = { countryId: "uae", cityId: "dubai", industryId: "logistics" };

    await source.fetch(request);

    expect(source.requests).toEqual([request]);
  });

  it("fails loudly when a test asks for more behaviour than it set up", async () => {
    const source = fakeSucceededSource("file_import");

    await source.fetch({ countryId: "uae", industryId: "logistics" });

    await expect(
      source.fetch({ countryId: "uae", industryId: "logistics" }),
    ).rejects.toThrow(/no result left for call 2/);
  });

  it("can play a sequence of results in order", async () => {
    const source = new FakeDiscoverySource("file_import", [
      { outcome: "blocked", note: "first call" },
      { outcome: "failed", reason: "second call" },
    ]);

    await expect(source.fetch({ countryId: "uae", industryId: "logistics" })).resolves.toEqual({
      outcome: "blocked",
      note: "first call",
    });
    await expect(source.fetch({ countryId: "uae", industryId: "logistics" })).resolves.toEqual({
      outcome: "failed",
      reason: "second call",
    });
  });
});
