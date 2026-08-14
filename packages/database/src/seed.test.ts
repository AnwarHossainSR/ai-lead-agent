import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { companies } from "./schema/companies";
import { contacts } from "./schema/contacts";
import { leads } from "./schema/leads";
import { outreach } from "./schema/outreach";
import { websiteAnalysis } from "./schema/website-analysis";
import { SeedRefusedError, assertSeedable, seed } from "./seed";
import { EXAMPLE_COMPANIES } from "./seed-data";
import { accountInput } from "./testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "./testing/harness";
import { insertAccount } from "./write/accounts";

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

/**
 * The seed attributes approvals, rejections, sends and do-not-contact markers
 * to a real account, because the database refuses those rows otherwise. Every
 * test that seeds therefore needs an operator to exist first — which is the
 * same ordering `pnpm db:fresh:seed` enforces.
 */
async function givenAnOperator(): Promise<void> {
  await insertAccount(harness.database, accountInput({ role: "operator" }));
}

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
    await givenAnOperator();

    const result = await seed(harness.database);

    expect(result.seeded).toBe(true);

    const written = await counts();
    expect(written.companies).toBe(EXAMPLE_COMPANIES.length);
    for (const [table, count] of Object.entries(written)) {
      expect(count, `${table} should have rows`).toBeGreaterThan(0);
    }
  });

  it("is idempotent — a second run leaves the counts unchanged", async () => {
    await givenAnOperator();
    await seed(harness.database);
    const afterFirst = await counts();

    const second = await seed(harness.database);

    expect(second.seeded).toBe(false);
    expect(await counts()).toEqual(afterFirst);
  });

  it("refuses, rather than writing unattributed rows, when no operator exists", async () => {
    await expect(seed(harness.database)).rejects.toThrow(SeedRefusedError);
    await expect(seed(harness.database)).rejects.toThrow(/no enabled operator account/);

    expect((await counts()).companies).toBe(0);
  });
});

describe("seeded records", () => {
  beforeEach(async () => {
    await givenAnOperator();
    await seed(harness.database);
  });

  it("are all marked as example data", async () => {
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
    const rows = await harness.database.select().from(companies);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.name.startsWith("Example"))).toBe(true);
  });

  it("include an unmeasured score, so unknown is visible in local data", async () => {
    const rows = await harness.database.select().from(websiteAnalysis);

    expect(rows.some((row) => row.accessibilityScore === null)).toBe(true);
    expect(rows.some((row) => row.performanceScore !== null)).toBe(true);
  });

  /**
   * A seed containing only complete rows teaches the interface to look good on
   * data it will never see. These are the states most easily forgotten.
   */
  it("includes a company with no website at all", async () => {
    const rows = await harness.database.select().from(companies);

    expect(rows.some((row) => row.website === null)).toBe(true);
  });

  it("includes an analysis that was blocked, not merely low-scoring", async () => {
    const rows = await harness.database.select().from(websiteAnalysis);

    expect(rows.some((row) => row.outcome === "blocked")).toBe(true);
    expect(rows.some((row) => row.outcome === "partial")).toBe(true);
    expect(rows.some((row) => row.outcome === "completed")).toBe(true);
  });

  it("covers every outreach status a reviewer can encounter", async () => {
    const rows = await harness.database.select().from(outreach);
    const statuses = new Set(rows.map((row) => row.status));

    for (const status of ["draft", "pending_approval", "approved", "sent", "replied", "rejected"]) {
      expect(statuses, `expected a ${status} record`).toContain(status);
    }
  });

  it("attributes every approval, rejection and send to the account that acted", async () => {
    const rows = await harness.database.select().from(outreach);

    for (const row of rows) {
      expect(row.approvedAt === null).toBe(row.approvedByAccountId === null);
      expect(row.rejectedAt === null).toBe(row.rejectedByAccountId === null);
      expect(row.sentAt === null).toBe(row.sentByAccountId === null);
    }

    expect(rows.some((row) => row.approvedByAccountId !== null)).toBe(true);
    expect(rows.some((row) => row.rejectedByAccountId !== null)).toBe(true);
    expect(rows.some((row) => row.sentByAccountId !== null)).toBe(true);
  });

  it("marks one company and one contact as do-not-contact", async () => {
    const companyRows = await harness.database.select().from(companies);
    const contactRows = await harness.database.select().from(contacts);

    expect(companyRows.some((row) => row.doNotContactAt !== null)).toBe(true);
    expect(contactRows.some((row) => row.doNotContactAt !== null)).toBe(true);
  });

  it("spreads leads across the score range rather than clustering them", async () => {
    const rows = await harness.database.select().from(leads);
    const scores = rows.map((row) => row.leadScore);

    expect(rows.length).toBeGreaterThan(5);
    expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThan(30);
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
