import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { contacts } from "../schema/contacts";
import { expectConstraintViolation } from "../testing/constraints";
import { companyInput, contactInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { insertCompany } from "./companies";
import { insertContact } from "./contacts";
import { WriteValidationError } from "./errors";

let harness: TestDatabase;
let companyId: string;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  const company = await insertCompany(harness.database, companyInput());
  companyId = company.id;
});

afterAll(async () => {
  await harness.close();
});

describe("a researched contact", () => {
  it("is stored and linked to its company", async () => {
    const row = await insertContact(
      harness.database,
      contactInput(companyId, { jobTitle: "Operations Director" }),
    );

    expect(row.companyId).toBe(companyId);
    expect(row.name).toBe("Example Contact");
    expect(row.jobTitle).toBe("Operations Director");
    expect(row.certainty).toBe("observed");
  });
});

describe("contact details without a source", () => {
  it("are refused when an email has no source URL, and nothing is created", async () => {
    await expect(
      insertContact(harness.database, contactInput(companyId, { email: "someone@example.ae" })),
    ).rejects.toThrow(WriteValidationError);

    expect(await harness.database.select().from(contacts)).toHaveLength(0);
  });

  it("are refused when a phone number has no source URL", async () => {
    await expect(
      insertContact(harness.database, contactInput(companyId, { phone: "+971 4 000 0000" })),
    ).rejects.toThrow(/must arrive with the URL it was observed at/);
  });

  it("are accepted once the source URL is present", async () => {
    const row = await insertContact(
      harness.database,
      contactInput(companyId, {
        email: "someone@example.ae",
        sourceUrl: "https://example.ae/team",
      }),
    );

    expect(row.email).toBe("someone@example.ae");
    expect(row.sourceUrl).toBe("https://example.ae/team");
  });

  it("are refused by the database as well, not only by the helper", async () => {
    // A raw insert bypasses the Zod schema entirely, which is what a future
    // worker or a hand-written statement would do. The CHECK constraint is
    // what stops it.
    await expectConstraintViolation(
      harness.database.insert(contacts).values({
        id: "019fecbb-0000-7000-8000-000000000000",
        companyId,
        name: "Example Contact",
        email: "guessed@example.ae",
        certainty: "inferred",
        researchSource: "pattern guess",
        sourceUrl: null,
      }),
      "contacts_contact_details_need_a_source",
    );
  });
});

describe("a contact detail that could not be found", () => {
  it("is stored as null, distinguishable from an empty string", async () => {
    const row = await insertContact(harness.database, contactInput(companyId));

    expect(row.email).toBeNull();
    expect(row.phone).toBeNull();
    expect(row.jobTitle).toBeNull();
  });

  it("cannot be written as a blank string instead", async () => {
    await expect(
      insertContact(harness.database, contactInput(companyId, { jobTitle: "  " })),
    ).rejects.toThrow(/a blank string is not a fact/);
  });
});

describe("certainty", () => {
  it("must be observed or inferred — there is no value for a guess", async () => {
    await expect(
      insertContact(
        harness.database,
        contactInput(companyId, { certainty: "guessed" as "observed" }),
      ),
    ).rejects.toThrow(WriteValidationError);
  });
});
