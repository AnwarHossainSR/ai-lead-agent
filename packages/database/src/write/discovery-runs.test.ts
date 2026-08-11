import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { companies } from "../schema/companies";
import {
  companyDiscoverySources,
  discoveryRunSources,
  discoveryRuns,
} from "../schema/discovery";
import { companyInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { insertCompany } from "./companies";
import {
  finishDiscoveryRun,
  recordCompanyDiscoverySource,
  recordDiscoveryRunSource,
  startDiscoveryRun,
} from "./discovery-runs";
import { WriteValidationError, isUniqueViolation } from "./errors";

/**
 * Walks Drizzle's error chain to the PostgreSQL error and names its
 * constraint, mirroring `isUniqueViolation` — Drizzle wraps driver errors in a
 * `DrizzleQueryError` whose `cause` is the real `PostgresError`.
 */
function violatesConstraint(error: unknown, constraint: string): boolean {
  let candidate: unknown = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof candidate !== "object" || candidate === null) {
      return false;
    }

    // postgres-js reports check violations as `constraint_name` and some other
    // errors as `constraint`; accepting both keeps the walk robust to the
    // driver's formatting.
    const { constraint: direct, constraint_name: named } = candidate as {
      constraint?: unknown;
      constraint_name?: unknown;
    };

    if (direct === constraint || named === constraint) {
      return true;
    }

    candidate = (candidate as { cause?: unknown }).cause;
  }

  return false;
}

let harness: TestDatabase;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
});

afterAll(async () => {
  await harness.close();
});

const runInput = {
  countryId: "uae",
  cityId: "dubai",
  industryId: "logistics",
  candidateLimit: 50,
  durationLimitSeconds: 300,
} as const;

describe("a discovery run is persisted with its request and outcome", () => {
  it("stores the territory, limits, and both timestamps around a finish", async () => {
    const run = await startDiscoveryRun(harness.database, runInput);

    expect(run.countryId).toBe("uae");
    expect(run.cityId).toBe("dubai");
    expect(run.industryId).toBe("logistics");
    expect(run.candidateLimit).toBe(50);
    expect(run.durationLimitSeconds).toBe(300);
    expect(run.outcome).toBe("running");
    expect(run.finishedAt).toBeNull();

    const finished = await finishDiscoveryRun(harness.database, run.id, {
      outcome: "succeeded",
    });

    expect(finished.outcome).toBe("succeeded");
    expect(finished.finishedAt).not.toBeNull();
    expect(finished.finishedAt!.getTime()).toBeGreaterThanOrEqual(finished.startedAt.getTime());
  });

  it("refuses an outcome outside the defined set", async () => {
    const run = await startDiscoveryRun(harness.database, runInput);

    await expect(
      finishDiscoveryRun(harness.database, run.id, {
        outcome: "triumphed",
      } as never),
    ).rejects.toThrow(WriteValidationError);
  });

  it("refuses 'running' as a finishing outcome", async () => {
    const run = await startDiscoveryRun(harness.database, runInput);

    await expect(
      finishDiscoveryRun(harness.database, run.id, { outcome: "running" }),
    ).rejects.toThrow(WriteValidationError);
  });

  it("rejects a finish time before the start at the database", async () => {
    // The write helper always stamps the database clock, so the contradiction
    // it prevents can only be provoked by a raw insert. The CHECK constraint
    // is what answers for it.
    const run = await startDiscoveryRun(harness.database, runInput);

    try {
      await harness.database
        .update(discoveryRuns)
        .set({ finishedAt: new Date(run.startedAt.getTime() - 60_000) })
        .where(eq(discoveryRuns.id, run.id));
      expect.unreachable("The database accepted a finish before its start.");
    } catch (error) {
      expect(violatesConstraint(error, "discovery_runs_finished_at_after_started_at")).toBe(true);
    }
  });

  it("refuses a zero candidate limit", async () => {
    await expect(
      startDiscoveryRun(harness.database, { ...runInput, candidateLimit: 0 }),
    ).rejects.toThrow(/Expected a positive integer/);
  });

  it("refuses an unknown territory or industry, naming it", async () => {
    await expect(
      startDiscoveryRun(harness.database, { ...runInput, countryId: "qatar", cityId: null }),
    ).rejects.toThrow(/Unknown country identifier "qatar"/);

    await expect(
      startDiscoveryRun(harness.database, { ...runInput, industryId: "mining" }),
    ).rejects.toThrow(/Unknown industry identifier "mining"/);
  });
});

describe("per-source results are persisted separately from the run", () => {
  it("gives each consulted source its own row", async () => {
    const run = await startDiscoveryRun(harness.database, runInput);

    for (const sourceId of ["file_import", "places", "business_directory"]) {
      await recordDiscoveryRunSource(harness.database, {
        runId: run.id,
        sourceId,
        outcome: "succeeded",
        returnedCount: 3,
        storedCount: 2,
        duplicateCount: 1,
        rejectedCount: 0,
      });
    }

    const rows = await harness.database
      .select()
      .from(discoveryRunSources)
      .where(eq(discoveryRunSources.runId, run.id));

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.sourceId).sort()).toEqual([
      "business_directory",
      "file_import",
      "places",
    ]);
  });

  it("refuses a negative count", async () => {
    const run = await startDiscoveryRun(harness.database, runInput);

    await expect(
      recordDiscoveryRunSource(harness.database, {
        runId: run.id,
        sourceId: "file_import",
        outcome: "succeeded",
        returnedCount: -1,
      }),
    ).rejects.toThrow(WriteValidationError);
  });

  it("rejects an unknown source identifier, listing the configured ones", async () => {
    const run = await startDiscoveryRun(harness.database, runInput);

    await expect(
      recordDiscoveryRunSource(harness.database, {
        runId: run.id,
        sourceId: "linkedin",
        outcome: "succeeded",
      }),
    ).rejects.toThrow(/Unknown discovery source identifier "linkedin"/);
  });

  it("refuses the same source twice for one run", async () => {
    const run = await startDiscoveryRun(harness.database, runInput);
    const row = {
      runId: run.id,
      sourceId: "file_import",
      outcome: "succeeded",
      returnedCount: 1,
    } as const;

    await recordDiscoveryRunSource(harness.database, row);

    await expect(
      recordDiscoveryRunSource(harness.database, row).catch((error) =>
        isUniqueViolation(error, "discovery_run_sources_run_source_key"),
      ),
    ).resolves.toBe(true);
  });

  it("stores rejection reasons so they can be counted", async () => {
    const run = await startDiscoveryRun(harness.database, runInput);

    await recordDiscoveryRunSource(harness.database, {
      runId: run.id,
      sourceId: "file_import",
      outcome: "succeeded",
      rejectedCount: 2,
      rejections: [
        { reason: "missing_source_url", count: 1 },
        { reason: "malformed_row", count: 1 },
      ],
    });

    const [row] = await harness.database
      .select()
      .from(discoveryRunSources)
      .where(eq(discoveryRunSources.runId, run.id));

    expect(row!.rejections).toEqual([
      { reason: "missing_source_url", count: 1 },
      { reason: "malformed_row", count: 1 },
    ]);
  });

  it("deleting a run removes its per-source rows", async () => {
    const run = await startDiscoveryRun(harness.database, runInput);
    await recordDiscoveryRunSource(harness.database, {
      runId: run.id,
      sourceId: "file_import",
      outcome: "succeeded",
    });

    await harness.database.delete(discoveryRuns).where(eq(discoveryRuns.id, run.id));

    expect(await harness.database.select().from(discoveryRunSources)).toHaveLength(0);
  });
});

describe("a company records the run that first found it", () => {
  it("references its run when created by discovery", async () => {
    const run = await startDiscoveryRun(harness.database, runInput);
    const company = await insertCompany(
      harness.database,
      companyInput({ discoveryRunId: run.id }),
    );

    expect(company.discoveryRunId).toBe(run.id);
  });

  it("survives its run's deletion, with the run reference cleared", async () => {
    const run = await startDiscoveryRun(harness.database, runInput);
    const company = await insertCompany(
      harness.database,
      companyInput({ discoveryRunId: run.id }),
    );

    await harness.database.delete(discoveryRuns).where(eq(discoveryRuns.id, run.id));

    const [remaining] = await harness.database
      .select()
      .from(companies)
      .where(eq(companies.id, company.id));

    expect(remaining!.discoveryRunId).toBeNull();
  });

  it("needs no run reference when created by hand", async () => {
    const company = await insertCompany(harness.database, companyInput());

    expect(company.discoveryRunId).toBeNull();
  });
});

describe("a company records every source that found it", () => {
  it("records a second source against an existing company", async () => {
    const company = await insertCompany(harness.database, companyInput());

    await recordCompanyDiscoverySource(harness.database, {
      companyId: company.id,
      sourceId: "file_import",
      sourceUrl: "https://import.example/list.csv",
    });
    await recordCompanyDiscoverySource(harness.database, {
      companyId: company.id,
      sourceId: "places",
      sourceUrl: "https://places.example/record/1",
    });

    const rows = await harness.database
      .select()
      .from(companyDiscoverySources)
      .where(eq(companyDiscoverySources.companyId, company.id));

    expect(rows).toHaveLength(2);
  });

  it("does not duplicate the same source finding the same company twice", async () => {
    const company = await insertCompany(harness.database, companyInput());

    await recordCompanyDiscoverySource(harness.database, {
      companyId: company.id,
      sourceId: "file_import",
      sourceUrl: "https://import.example/list.csv",
    });
    const first = await harness.database
      .select()
      .from(companyDiscoverySources)
      .where(eq(companyDiscoverySources.companyId, company.id));

    await recordCompanyDiscoverySource(harness.database, {
      companyId: company.id,
      sourceId: "file_import",
      sourceUrl: "https://import.example/updated.csv",
    });

    const rows = await harness.database
      .select()
      .from(companyDiscoverySources)
      .where(eq(companyDiscoverySources.companyId, company.id));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.firstSeenAt.getTime()).toBe(first[0]!.firstSeenAt.getTime());
    expect(rows[0]!.lastSeenAt.getTime()).toBeGreaterThanOrEqual(first[0]!.lastSeenAt.getTime());
    expect(rows[0]!.sourceUrl).toBe("https://import.example/updated.csv");
  });

  it("refuses a blank source URL and an unknown source", async () => {
    const company = await insertCompany(harness.database, companyInput());

    await expect(
      recordCompanyDiscoverySource(harness.database, {
        companyId: company.id,
        sourceId: "file_import",
        sourceUrl: "   ",
      }),
    ).rejects.toThrow(WriteValidationError);

    await expect(
      recordCompanyDiscoverySource(harness.database, {
        companyId: company.id,
        sourceId: "linkedin",
        sourceUrl: "https://example.com/x",
      }),
    ).rejects.toThrow(/Unknown discovery source identifier "linkedin"/);
  });

  it("deleting a company removes its source records", async () => {
    const company = await insertCompany(harness.database, companyInput());
    await recordCompanyDiscoverySource(harness.database, {
      companyId: company.id,
      sourceId: "file_import",
      sourceUrl: "https://import.example/list.csv",
    });

    await harness.database.delete(companies).where(eq(companies.id, company.id));

    expect(await harness.database.select().from(companyDiscoverySources)).toHaveLength(0);
  });
});
