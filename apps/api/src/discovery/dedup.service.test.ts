import {
  type DiscoveryRunRow,
  companies,
  companyDiscoverySources,
  startDiscoveryRun,
} from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { type DedupInput, DedupService } from "./dedup.service";
import type { DiscoveredCandidate } from "./sources/source";

/**
 * Task 5.3 — the deduplication rules (design D5) against real PostgreSQL: the
 * partial unique index on `normalized_domain` and the provenance upsert only
 * exist in the database, so an in-memory substitute would prove nothing about
 * them. Runs against the same dedicated `_test` database as the write helpers
 * via `@mela/database/testing`.
 */

let harness: TestDatabase;
const service = new DedupService();

function dedupInput(
  candidate: DiscoveredCandidate,
  overrides: Partial<Omit<DedupInput, "candidate">> = {},
): DedupInput {
  return {
    candidate,
    runId: "00000000-0000-4000-8000-000000000001",
    sourceId: "file_import",
    countryId: "uae",
    cityId: "dubai",
    industryId: "logistics",
    ...overrides,
  };
}

function candidate(overrides: Partial<DiscoveredCandidate> = {}): DiscoveredCandidate {
  return {
    name: "Example Trading L.L.C.",
    sourceUrl: "https://fixture.example/companies/example-trading",
    ...overrides,
  };
}

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
});

afterAll(async () => {
  await harness.close();
});

async function openRun(): Promise<DiscoveryRunRow> {
  return startDiscoveryRun(harness.database, {
    countryId: "uae",
    cityId: "dubai",
    industryId: "logistics",
    candidateLimit: 100,
    durationLimitSeconds: 300,
  });
}

describe("two sources yielding one company", () => {
  it("stores the first and records the second as a duplicate with both provenances", async () => {
    const run = await openRun();
    const input = dedupInput(candidate({ website: "https://example.ae" }), {
      runId: run.id,
    });

    const first = await service.deduplicate(harness.database, input);
    const second = await service.deduplicate(
      harness.database,
      dedupInput(candidate({ website: "https://www.example.ae" }), {
        runId: run.id,
        sourceId: "places",
      }),
    );

    expect(first.kind).toBe("stored");
    expect(second.kind).toBe("duplicate");
    expect(second.company.id).toBe(first.company.id);

    const rows = await harness.database.select().from(companies);
    expect(rows).toHaveLength(1);

    const provenances = (await harness.database.select().from(companyDiscoverySources)).filter(
      (row) => row.companyId === first.company.id,
    );
    expect(provenances.map((row) => row.sourceId).sort()).toEqual(["file_import", "places"]);
  });

  it("treats the second visit from the same source as a duplicate, not a second row", async () => {
    const run = await openRun();
    const input = dedupInput(candidate({ website: "https://example.ae" }), { runId: run.id });

    const first = await service.deduplicate(harness.database, input);
    const again = await service.deduplicate(harness.database, input);

    expect(first.kind).toBe("stored");
    expect(again.kind).toBe("duplicate");
    expect(again.company.id).toBe(first.company.id);

    const rows = await harness.database.select().from(companies);
    expect(rows).toHaveLength(1);

    // Rediscovery updates the existing provenance row rather than adding one.
    const provenances = (await harness.database.select().from(companyDiscoverySources)).filter(
      (row) => row.companyId === first.company.id,
    );
    expect(provenances).toHaveLength(1);
  });
});

describe("a website-less candidate", () => {
  it("is matched by normalized name within the same country", async () => {
    const run = await openRun();
    const base = dedupInput(candidate({ sourceUrl: "https://fixture.example/companies/a" }), {
      runId: run.id,
    });

    const first = await service.deduplicate(harness.database, base);
    const second = await service.deduplicate(
      harness.database,
      dedupInput(
        candidate({
          name: "Example Trading LLC",
          sourceUrl: "https://fixture.example/companies/b",
        }),
        { runId: run.id },
      ),
    );

    expect(first.kind).toBe("stored");
    expect(second.kind).toBe("duplicate");
    expect(second.company.id).toBe(first.company.id);

    const rows = await harness.database.select().from(companies);
    expect(rows).toHaveLength(1);
  });

  it("keeps two website-less companies with different names as separate rows", async () => {
    const run = await openRun();

    const first = await service.deduplicate(
      harness.database,
      dedupInput(
        candidate({ name: "Al Noor Trading", sourceUrl: "https://fixture.example/companies/a" }),
        {
          runId: run.id,
        },
      ),
    );
    const second = await service.deduplicate(
      harness.database,
      dedupInput(
        candidate({ name: "Gulf Shipping Co.", sourceUrl: "https://fixture.example/companies/b" }),
        {
          runId: run.id,
        },
      ),
    );

    expect(first.kind).toBe("stored");
    expect(second.kind).toBe("stored");
    expect(second.company.id).not.toBe(first.company.id);

    const rows = await harness.database.select().from(companies);
    expect(rows).toHaveLength(2);
  });

  it("keeps the same name in a different country as a separate company", async () => {
    const run = await openRun();

    const uae = await service.deduplicate(
      harness.database,
      dedupInput(candidate({ sourceUrl: "https://fixture.example/companies/a" }), {
        runId: run.id,
      }),
    );
    const saudi = await service.deduplicate(
      harness.database,
      dedupInput(candidate({ sourceUrl: "https://fixture.example/companies/b" }), {
        runId: run.id,
        countryId: "saudi_arabia",
        cityId: "riyadh",
      }),
    );

    expect(uae.kind).toBe("stored");
    expect(saudi.kind).toBe("stored");
    expect(saudi.company.id).not.toBe(uae.company.id);

    const rows = await harness.database.select().from(companies);
    expect(rows).toHaveLength(2);
  });
});

describe("the dedup ordering", () => {
  it("prefers the website match over a same-name match", async () => {
    const run = await openRun();

    // Same normalized name, but the stored company has a website while the
    // new candidate has a different one: the domain wins, so no merge happens.
    const stored = await service.deduplicate(
      harness.database,
      dedupInput(candidate({ name: "Example Trading L.L.C.", website: "https://example.ae" }), {
        runId: run.id,
      }),
    );
    const otherDomain = await service.deduplicate(
      harness.database,
      dedupInput(candidate({ name: "Example Trading LLC", website: "https://other-example.ae" }), {
        runId: run.id,
      }),
    );

    expect(stored.kind).toBe("stored");
    expect(otherDomain.kind).toBe("stored");
    expect(otherDomain.company.id).not.toBe(stored.company.id);

    const rows = await harness.database.select().from(companies);
    expect(rows).toHaveLength(2);
  });

  it("falls back to the name comparison when the website is not registrable", async () => {
    const run = await openRun();

    const stored = await service.deduplicate(
      harness.database,
      dedupInput(candidate({ website: "http://localhost" }), { runId: run.id }),
    );
    const again = await service.deduplicate(
      harness.database,
      dedupInput(candidate({ website: "192.168.1.1" }), { runId: run.id }),
    );

    expect(stored.kind).toBe("stored");
    expect(again.kind).toBe("duplicate");
    expect(again.company.id).toBe(stored.company.id);
  });
});
