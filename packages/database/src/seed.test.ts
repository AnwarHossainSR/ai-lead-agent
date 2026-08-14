import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { companies } from "./schema/companies";
import { contacts } from "./schema/contacts";
import { leads } from "./schema/leads";
import { outreach } from "./schema/outreach";
import { websiteAnalysis } from "./schema/website-analysis";
import { SeedRefusedError, assertSeedable, seed } from "./seed";
import { type TestDatabase, setupTestDatabase } from "./testing/harness";

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

async function counts(): Promise<Record<string, number>> {
  const [row] = await harness.database
    .select({
      companies: sql<number>`(SELECT count(*)::int FROM ${companies})`,
      contacts: sql<number>`(SELECT count(*)::int FROM ${contacts})`,
      analyses: sql<number>`(SELECT count(*)::int FROM ${websiteAnalysis})`,
      leads: sql<number>`(SELECT count(*)::int FROM ${leads})`,
      outreach: sql<number>`(SELECT count(*)::int FROM ${outreach})`,
    })
    .from(sql`(SELECT 1) AS one`);

  return row ?? {};
}

describe("seeding", () => {
  it("writes an example dataset across every table", async () => {
    const result = await seed(harness.database);

    expect(result.seeded).toBe(true);
    expect(await counts()).toEqual({
      // Two illustrative companies (one analysed, one with no website) plus the
      // lead spread, which exists so the workspace has more than one row to
      // render.
      companies: 8,
      contacts: 1,
      analyses: 1,
      leads: 7,
      outreach: 1,
    });
  });

  it("is idempotent — a second run leaves the counts unchanged", async () => {
    await seed(harness.database);
    const afterFirst = await counts();

    const second = await seed(harness.database);

    expect(second.seeded).toBe(false);
    expect(await counts()).toEqual(afterFirst);
  });
});

describe("seeded records", () => {
  it("are all marked as example data", async () => {
    await seed(harness.database);

    const companyRows = await harness.database.select().from(companies);
    const contactRows = await harness.database.select().from(contacts);
    const analysisRows = await harness.database.select().from(websiteAnalysis);
    const leadRows = await harness.database.select().from(leads);
    const outreachRows = await harness.database.select().from(outreach);

    for (const rows of [companyRows, contactRows, analysisRows, leadRows, outreachRows]) {
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.isExample)).toBe(true);
    }
  });

  it("are named so they cannot be mistaken for researched data", async () => {
    await seed(harness.database);

    const rows = await harness.database.select().from(companies);
    expect(rows.every((row) => row.name.startsWith("Example"))).toBe(true);
  });

  it("include an unmeasured score, so unknown is visible in local data", async () => {
    await seed(harness.database);

    const [analysis] = await harness.database.select().from(websiteAnalysis);
    expect(analysis?.accessibilityScore).toBeNull();
    expect(analysis?.performanceScore).toBe(42);
  });

  it("cover several priorities and lifecycle statuses, not one row repeated", async () => {
    await seed(harness.database);

    const rows = await harness.database.select().from(leads);

    expect(new Set(rows.map((row) => row.priority)).size).toBeGreaterThan(2);
    expect(new Set(rows.map((row) => row.status)).size).toBeGreaterThan(3);
  });

  it("include both a freshly scored lead and a stale one", async () => {
    await seed(harness.database);

    const rows = await harness.database.select().from(leads);
    const ages = rows.map((row) => Date.now() - row.scoredAt.getTime());
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    expect(ages.some((age) => age < thirtyDays)).toBe(true);
    expect(ages.some((age) => age > thirtyDays)).toBe(true);
  });

  it("reach every status through the lifecycle, never by writing the column", async () => {
    await seed(harness.database);

    const rows = await harness.database.select().from(leads);
    const statuses = rows.map((row) => row.status);

    // `sent`-like end states are reachable only through the transition map, so
    // their presence is itself the assertion that the walk was legal.
    expect(statuses).toContain("won");
    expect(statuses).toContain("rejected");
  });

  it("leave the outreach draft unapproved and unsent", async () => {
    await seed(harness.database);

    const [draft] = await harness.database.select().from(outreach);
    expect(draft?.status).toBe("draft");
    expect(draft?.approvedAt).toBeNull();
    expect(draft?.sentAt).toBeNull();
  });
});

describe("seeding a database that is not designated as development", () => {
  const developmentUrl = "postgresql://mela:local@localhost:5433/mela";

  it("is refused when NODE_ENV is production", () => {
    expect(() => assertSeedable(developmentUrl, "production")).toThrow(SeedRefusedError);
    expect(() => assertSeedable(developmentUrl, "production")).toThrow(/NODE_ENV is "production"/);
  });

  it("is refused when NODE_ENV is unset", () => {
    expect(() => assertSeedable(developmentUrl, undefined)).toThrow(/NODE_ENV is not set/);
  });

  it("is refused when the database is not on this machine", () => {
    expect(() =>
      assertSeedable("postgresql://mela:local@db.production.example.com:5432/mela", "development"),
    ).toThrow(/the database host is "db.production.example.com"/);
  });

  it("is permitted for a local development or test database", () => {
    expect(() => assertSeedable(developmentUrl, "development")).not.toThrow();
    expect(() => assertSeedable(developmentUrl, "test")).not.toThrow();
    expect(() =>
      assertSeedable("postgresql://mela:local@127.0.0.1:5433/mela_test", "test"),
    ).not.toThrow();
  });
});
