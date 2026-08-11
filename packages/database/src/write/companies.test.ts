import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { companies } from "../schema/companies";
import { contacts } from "../schema/contacts";
import { leads } from "../schema/leads";
import { companyInput, contactInput, leadInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { DuplicateCompanyError, WriteValidationError } from "./errors";
import { insertCompany, updateCompany } from "./companies";
import { insertContact } from "./contacts";
import { insertLead } from "./leads";

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

describe("a discovered company", () => {
  it("is stored with its source and readable with every value intact", async () => {
    const row = await insertCompany(
      harness.database,
      companyInput({
        website: "https://www.example.ae/about?x=1",
        companySize: "50-200",
        description: "An example company.",
      }),
    );

    expect(row.name).toBe("Example Trading L.L.C.");
    expect(row.countryId).toBe("uae");
    expect(row.cityId).toBe("dubai");
    expect(row.industryId).toBe("logistics");
    expect(row.discoverySource).toBe("test fixture");
    expect(row.discoverySourceUrl).toBe("https://example.com/fixture");
    expect(row.companySize).toBe("50-200");
  });

  it("has its creation and update timestamps set automatically", async () => {
    const row = await insertCompany(harness.database, companyInput());

    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);
  });

  it("gets its normalized name and domain derived, not supplied", async () => {
    const row = await insertCompany(
      harness.database,
      companyInput({ website: "https://WWW.Example.ae:443/about?x=1" }),
    );

    expect(row.normalizedName).toBe("example trading");
    expect(row.normalizedDomain).toBe("example.ae");
  });
});

describe("a company without a source", () => {
  it("is refused, and nothing is created", async () => {
    const input = companyInput();
    const { discoverySource: _discarded, ...withoutSource } = input;

    await expect(insertCompany(harness.database, withoutSource as typeof input)).rejects.toThrow(
      WriteValidationError,
    );

    const rows = await harness.database.select().from(companies);
    expect(rows).toHaveLength(0);
  });

  it("is refused when the source is blank", async () => {
    await expect(
      insertCompany(harness.database, companyInput({ discoverySource: "   " })),
    ).rejects.toThrow(/Expected the source this company was found in/);
  });
});

describe("a company referencing unknown configuration", () => {
  it("is refused, naming the unknown country", async () => {
    await expect(
      insertCompany(harness.database, companyInput({ countryId: "qatar", cityId: null })),
    ).rejects.toThrow(/Unknown country identifier "qatar"/);
  });

  it("is refused, naming the unknown city", async () => {
    await expect(insertCompany(harness.database, companyInput({ cityId: "doha" }))).rejects.toThrow(
      /Unknown city identifier "doha"/,
    );
  });

  it("is refused, naming the unknown industry", async () => {
    await expect(
      insertCompany(harness.database, companyInput({ industryId: "mining" })),
    ).rejects.toThrow(/Unknown industry identifier "mining"/);
  });

  it("is refused when the city belongs to a different country", async () => {
    await expect(
      insertCompany(harness.database, companyInput({ countryId: "uae", cityId: "riyadh" })),
    ).rejects.toThrow(/City "riyadh" belongs to country "saudi_arabia", not "uae"/);
  });

  it("lists what is configured, so the caller does not have to read the source", async () => {
    await expect(
      insertCompany(harness.database, companyInput({ industryId: "mining" })),
    ).rejects.toThrow(/Configured industrys: real_estate/);
  });
});

describe("unknown optional attributes", () => {
  it("are stored as null rather than as an empty string", async () => {
    const row = await insertCompany(harness.database, companyInput());

    expect(row.linkedinUrl).toBeNull();
    expect(row.companySize).toBeNull();
    expect(row.description).toBeNull();
    expect(row.website).toBeNull();
    expect(row.normalizedDomain).toBeNull();
  });

  it("cannot be written as an empty string", async () => {
    await expect(
      insertCompany(harness.database, companyInput({ description: "   " })),
    ).rejects.toThrow(/a blank string is not a fact/);
  });
});

describe("deduplication by normalized domain", () => {
  it("resolves the same site in different forms to one domain", async () => {
    const first = await insertCompany(
      harness.database,
      companyInput({ website: "https://WWW.Example.ae/about?x=1" }),
    );

    expect(first.normalizedDomain).toBe("example.ae");

    for (const website of ["http://example.ae", "https://example.ae:443/"]) {
      await expect(insertCompany(harness.database, companyInput({ website }))).rejects.toThrow(
        DuplicateCompanyError,
      );
    }
  });

  it("rejects a duplicate and identifies the company already there", async () => {
    const existing = await insertCompany(
      harness.database,
      companyInput({ website: "https://example.ae" }),
    );

    await expect(
      insertCompany(harness.database, companyInput({ website: "https://www.example.ae/contact" })),
    ).rejects.toThrow(new RegExp(existing.id));

    const rows = await harness.database
      .select()
      .from(companies)
      .where(eq(companies.normalizedDomain, "example.ae"));

    expect(rows).toHaveLength(1);
  });

  it("does not collide website-less companies with each other", async () => {
    await insertCompany(harness.database, companyInput({ name: "Example One" }));
    await insertCompany(harness.database, companyInput({ name: "Example Two" }));
    await insertCompany(harness.database, companyInput({ name: "Example Three" }));

    const rows = await harness.database.select().from(companies);
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.normalizedDomain === null)).toBe(true);
  });

  it("refuses a duplicate introduced by an update", async () => {
    await insertCompany(harness.database, companyInput({ website: "https://example.ae" }));
    const other = await insertCompany(
      harness.database,
      companyInput({ name: "Example Two", website: "https://other.ae" }),
    );

    await expect(
      updateCompany(harness.database, other.id, { website: "https://www.example.ae" }),
    ).rejects.toThrow(DuplicateCompanyError);
  });
});

describe("updating a company", () => {
  it("re-derives the normalization keys and advances the update timestamp", async () => {
    const created = await insertCompany(harness.database, companyInput());

    const updated = await updateCompany(harness.database, created.id, {
      name: "Example Trading FZE",
      website: "https://www.example-trading.ae/",
    });

    expect(updated.normalizedName).toBe("example trading");
    expect(updated.normalizedDomain).toBe("example-trading.ae");
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it("refuses an update that changes nothing", async () => {
    const created = await insertCompany(harness.database, companyInput());

    await expect(updateCompany(harness.database, created.id, {})).rejects.toThrow(
      /at least one field to change/,
    );
  });
});

describe("deleting a company", () => {
  it("removes its contacts and its lead, leaving nothing orphaned", async () => {
    const company = await insertCompany(harness.database, companyInput());
    await insertContact(harness.database, contactInput(company.id));
    await insertLead(harness.database, leadInput(company.id));

    await harness.database.delete(companies).where(eq(companies.id, company.id));

    expect(await harness.database.select().from(contacts)).toHaveLength(0);
    expect(await harness.database.select().from(leads)).toHaveLength(0);
  });
});
