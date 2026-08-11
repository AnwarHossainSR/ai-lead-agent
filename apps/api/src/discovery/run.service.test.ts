import {
  companies,
  discoveryRunSources,
} from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { RunService, type RunRequest } from "./run.service";
import {
  FakeDiscoverySource,
  fakeSucceededSource,
  fakeBlockedSource,
  fakeFailedSource,
} from "./testing/fake-source";
import type { DiscoverySourceId } from "@mela/config";

/**
 * Task 6.5 — integration tests for the run service (design D6).
 *
 * Tests run against a real PostgreSQL database via `@mela/database/testing`.
 * Each test creates a run, processes sources, and verifies the database state.
 *
 * NOTE: "places" is disabled in configuration, so tests use only "file_import"
 * which is the only enabled source for UAE.
 */

let harness: TestDatabase;
const runService = new RunService({ now: () => Date.now() });

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
});

afterAll(async () => {
  await harness.close();
});

function runRequest(overrides: Partial<RunRequest> = {}): RunRequest {
  return {
    countryId: "uae",
    cityId: "dubai",
    industryId: "logistics",
    candidateLimit: 100,
    durationLimitSeconds: 300,
    ...overrides,
  };
}

describe("territory validation", () => {
  it("accepts a configured country and industry", async () => {
    const source = fakeSucceededSource("file_import", []);
    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>([["file_import", source]]);

    const result = await runService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest(),
    );

    expect(result.run.outcome).toBe("succeeded");
    expect(result.storedCount).toBe(0);
  });

  it("refuses an unknown country", async () => {
    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>();

    await expect(
      runService.executeRun(
        harness.database,
        sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
        runRequest({ countryId: "unknown_country" }),
      ),
    ).rejects.toThrow('Unknown country identifier "unknown_country"');
  });

  it("refuses an unknown industry", async () => {
    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>();

    await expect(
      runService.executeRun(
        harness.database,
        sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
        runRequest({ industryId: "unknown_industry" }),
      ),
    ).rejects.toThrow('Unknown industry identifier "unknown_industry"');
  });

  it("refuses a city outside its country", async () => {
    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>();

    await expect(
      runService.executeRun(
        harness.database,
        sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
        runRequest({ cityId: "riyadh" }),
      ),
    ).rejects.toThrow('City "riyadh" belongs to country "saudi_arabia", not "uae"');
  });
});

describe("source selection", () => {
  it("consults only enabled sources covering the country", async () => {
    const fileImport = fakeSucceededSource("file_import", []);
    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", fileImport],
    ]);

    const result = await runService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest(),
    );

    expect(result.run.outcome).toBe("succeeded");
    expect(fileImport.requests).toHaveLength(1);
  });

  it("skips a source not provided in the sources map", async () => {
    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>();

    const result = await runService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest(),
    );

    expect(result.run.outcome).toBe("succeeded");

    // Check that file_import was recorded as skipped
    const allRunSources = await harness.database.select().from(discoveryRunSources);
    const runSources = allRunSources.filter((s) => s.runId === result.run.id);

    // file_import is enabled for uae, so it should be in the list
    const fileImportSource = runSources.find((s) => s.sourceId === "file_import");
    expect(fileImportSource?.outcome).toBe("skipped");
  });
});

describe("candidate processing", () => {
  it("stores candidates from a source", async () => {
    const source = fakeSucceededSource("file_import", [
      {
        name: "Test Trading LLC",
        sourceUrl: "https://fixture.example/companies/test-trading",
        website: "https://test-trading.ae",
      },
      {
        name: "Another Trading LLC",
        sourceUrl: "https://fixture.example/companies/another-trading",
        website: "https://another-trading.ae",
      },
    ]);

    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", source],
    ]);

    const result = await runService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest(),
    );

    expect(result.storedCount).toBe(2);
    expect(result.duplicateCount).toBe(0);

    const storedCompanies = await harness.database.select().from(companies);
    expect(storedCompanies).toHaveLength(2);
  });

  it("deduplicates candidates across runs", async () => {
    // First run stores the company
    const source1 = fakeSucceededSource("file_import", [
      {
        name: "Test Trading LLC",
        sourceUrl: "https://fixture.example/companies/test-trading",
        website: "https://test-trading.ae",
      },
    ]);

    const sources1 = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", source1],
    ]);

    const result1 = await runService.executeRun(
      harness.database,
      sources1 as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest(),
    );

    expect(result1.storedCount).toBe(1);

    // Second run finds the same company (duplicate) - create fresh source
    const source2 = fakeSucceededSource("file_import", [
      {
        name: "Test Trading LLC",
        sourceUrl: "https://fixture.example/companies/test-trading-2",
        website: "https://www.test-trading.ae",
      },
    ]);

    const sources2 = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", source2],
    ]);

    const result2 = await runService.executeRun(
      harness.database,
      sources2 as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest(),
    );

    expect(result2.storedCount).toBe(0);
    expect(result2.duplicateCount).toBe(1);

    // Only one company exists
    const storedCompanies = await harness.database.select().from(companies);
    expect(storedCompanies).toHaveLength(1);
  });

  it("rejects candidates without source URLs", async () => {
    const source = fakeSucceededSource("file_import", [
      {
        name: "Test Trading LLC",
        sourceUrl: "", // Empty source URL
      },
    ]);

    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", source],
    ]);

    const result = await runService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest(),
    );

    expect(result.storedCount).toBe(0);
    expect(result.rejectedCount).toBe(1);
  });
});

describe("source outcomes", () => {
  it("records a successful source", async () => {
    const source = fakeSucceededSource("file_import", [
      {
        name: "Test Trading LLC",
        sourceUrl: "https://fixture.example/companies/test-trading",
      },
    ]);

    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", source],
    ]);

    const result = await runService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest(),
    );

    const allRunSources = await harness.database.select().from(discoveryRunSources);
    const runSources = allRunSources.filter((s) => s.runId === result.run.id);

    expect(runSources).toHaveLength(1);
    expect(runSources[0]?.outcome).toBe("succeeded");
    expect(runSources[0]?.returnedCount).toBe(1);
    expect(runSources[0]?.storedCount).toBe(1);
  });

  it("records a blocked source", async () => {
    const source = fakeBlockedSource("file_import", "blocked by host");

    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", source],
    ]);

    const result = await runService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest(),
    );

    // With only one enabled source (file_import), if it's blocked, all sources are blocked -> "failed"
    expect(result.run.outcome).toBe("failed");
    expect(result.blockedSources).toContain("file_import");

    const allRunSources = await harness.database.select().from(discoveryRunSources);
    const runSources = allRunSources.filter((s) => s.runId === result.run.id);

    expect(runSources[0]?.outcome).toBe("blocked");
    expect(runSources[0]?.note).toBe("blocked by host");
  });

  it("records a failed source", async () => {
    const source = fakeFailedSource("file_import", "provider error");

    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", source],
    ]);

    const result = await runService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest(),
    );

    // With only one enabled source (file_import), if it fails, all sources failed -> "failed"
    expect(result.run.outcome).toBe("failed");
    expect(result.failedSources).toContain("file_import");

    const allRunSources = await harness.database.select().from(discoveryRunSources);
    const runSources = allRunSources.filter((s) => s.runId === result.run.id);

    expect(runSources[0]?.outcome).toBe("failed");
    expect(runSources[0]?.note).toBe("provider error");
  });
});

describe("limits", () => {
  it("ends the run when candidate limit is reached", async () => {
    const source = fakeSucceededSource("file_import", [
      {
        name: "Company 1",
        sourceUrl: "https://fixture.example/companies/1",
      },
      {
        name: "Company 2",
        sourceUrl: "https://fixture.example/companies/2",
      },
      {
        name: "Company 3",
        sourceUrl: "https://fixture.example/companies/3",
      },
    ]);

    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", source],
    ]);

    const result = await runService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest({ candidateLimit: 2 }),
    );

    expect(result.run.outcome).toBe("limit_reached");
    expect(result.storedCount).toBe(2);
    expect(result.run.failureReason).toBe("candidate_limit");

    const storedCompanies = await harness.database.select().from(companies);
    expect(storedCompanies).toHaveLength(2);
  });

  it("ends the run when duration limit is reached", async () => {
    let elapsed = 0;
    const now = () => {
      const current = elapsed;
      elapsed += 500; // Advance 500ms each call
      return current;
    };

    const fastRunService = new RunService({ now });

    const source = fakeSucceededSource("file_import", [
      {
        name: "Company 1",
        sourceUrl: "https://fixture.example/companies/1",
      },
    ]);

    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", source],
    ]);

    // Duration limit of 1 second; clock advances 500ms per call so after 2-3 calls we exceed it
    const result = await fastRunService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest({ durationLimitSeconds: 1 }),
    );

    expect(result.run.outcome).toBe("limit_reached");
    expect(result.run.failureReason).toBe("duration_limit");
  });

  it("retains companies stored before the limit", async () => {
    const source = fakeSucceededSource("file_import", [
      {
        name: "Company 1",
        sourceUrl: "https://fixture.example/companies/1",
      },
      {
        name: "Company 2",
        sourceUrl: "https://fixture.example/companies/2",
      },
    ]);

    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", source],
    ]);

    const result = await runService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest({ candidateLimit: 1 }),
    );

    expect(result.run.outcome).toBe("limit_reached");
    expect(result.storedCount).toBe(1);

    const storedCompanies = await harness.database.select().from(companies);
    expect(storedCompanies).toHaveLength(1);
    expect(storedCompanies[0]?.name).toBe("Company 1");
  });
});

describe("run completion", () => {
  it("records run with zero stored count as succeeded", async () => {
    const source = fakeSucceededSource("file_import", []);

    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", source],
    ]);

    const result = await runService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest(),
    );

    expect(result.run.outcome).toBe("succeeded");
    expect(result.storedCount).toBe(0);
    expect(result.run.finishedAt).not.toBeNull();
  });

  it("records run with all sources failed as failed", async () => {
    // Only file_import is enabled, so a single failed source means all sources failed
    const source = fakeFailedSource("file_import", "error");

    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", source],
    ]);

    const result = await runService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest(),
    );

    expect(result.run.outcome).toBe("failed");
    expect(result.failedSources).toEqual(["file_import"]);
  });

  it("records rejections with reasons", async () => {
    const source = fakeSucceededSource("file_import", [
      {
        name: "Valid Company",
        sourceUrl: "https://fixture.example/companies/valid",
      },
      {
        name: "Invalid Company",
        sourceUrl: "", // Missing source URL
      },
    ]);

    const sources = new Map<DiscoverySourceId, FakeDiscoverySource>([
      ["file_import", source],
    ]);

    const result = await runService.executeRun(
      harness.database,
      sources as unknown as ReadonlyMap<DiscoverySourceId, import("./sources/source").DiscoverySource>,
      runRequest(),
    );

    expect(result.storedCount).toBe(1);
    expect(result.rejectedCount).toBe(1);

    const allRunSources = await harness.database.select().from(discoveryRunSources);
    const runSources = allRunSources.filter((s) => s.runId === result.run.id);

    expect(runSources[0]?.rejectedCount).toBe(1);
    expect(runSources[0]?.rejections).toEqual([
      { reason: "missing_source_url", count: 1 },
    ]);
  });
});
