import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { contacts } from "../schema/contacts";
import { expectConstraintViolation } from "../testing/constraints";
import { accountInput, aiInvocationInput, companyInput, contactInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { insertAccount } from "./accounts";
import { insertAIInvocation } from "./ai-invocations";
import { insertCompany } from "./companies";
import {
  clearContactDoNotContact,
  deleteContactsForCompany,
  insertContact,
  setContactDoNotContact,
} from "./contacts";
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

  it("stores extraction method", async () => {
    const row = await insertContact(
      harness.database,
      contactInput(companyId, { extractionMethod: "deterministic" }),
    );

    expect(row.extractionMethod).toBe("deterministic");
  });

  it("stores seniority ID", async () => {
    const row = await insertContact(
      harness.database,
      contactInput(companyId, { seniorityId: "c-level", jobTitle: "CEO" }),
    );

    expect(row.seniorityId).toBe("c-level");
    expect(row.jobTitle).toBe("CEO");
  });

  it("stores role source URL", async () => {
    const row = await insertContact(
      harness.database,
      contactInput(companyId, { roleSourceUrl: "https://example.com/about" }),
    );

    expect(row.roleSourceUrl).toBe("https://example.com/about");
  });

  it("stores mail deliverability", async () => {
    const row = await insertContact(
      harness.database,
      contactInput(companyId, { mailDeliverability: "receivable" }),
    );

    expect(row.mailDeliverability).toBe("receivable");
  });
});

describe("interpreted contacts require invocation", () => {
  it("refuses model_interpretation without ai_invocation_id", async () => {
    await expectConstraintViolation(
      harness.database.insert(contacts).values({
        id: "019fecbb-0000-7000-8001-000000000000",
        companyId,
        name: "Interpreted Contact",
        certainty: "inferred",
        extractionMethod: "model_interpretation",
        researchSource: "model extraction",
        sourceUrl: "https://example.com/team",
      }),
      "contacts_interpreted_requires_invocation",
    );
  });

  it("accepts model_interpretation with ai_invocation_id", async () => {
    // First create an AI invocation to reference
    const invocation = await insertAIInvocation(harness.database, aiInvocationInput());

    const row = await insertContact(
      harness.database,
      contactInput(companyId, {
        extractionMethod: "model_interpretation",
        aiInvocationId: invocation.id,
      }),
    );

    expect(row.extractionMethod).toBe("model_interpretation");
    expect(row.aiInvocationId).toBe(invocation.id);
  });
});

describe("seniority requires job title", () => {
  it("refuses seniority_id without job_title", async () => {
    await expectConstraintViolation(
      harness.database.insert(contacts).values({
        id: "019fecbb-0000-7000-8003-000000000000",
        companyId,
        name: "Senior Contact",
        certainty: "observed",
        extractionMethod: "deterministic",
        seniorityId: "c-level",
        researchSource: "team page",
        sourceUrl: "https://example.com/team",
      }),
      "contacts_seniority_requires_title",
    );
  });

  it("accepts seniority_id with job_title", async () => {
    const row = await insertContact(
      harness.database,
      contactInput(companyId, {
        seniorityId: "c-level",
        jobTitle: "CEO",
      }),
    );

    expect(row.seniorityId).toBe("c-level");
    expect(row.jobTitle).toBe("CEO");
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
        extractionMethod: "deterministic",
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

describe("deleteContactsForCompany", () => {
  it("deletes all contacts for a company", async () => {
    // Create some contacts
    await insertContact(harness.database, contactInput(companyId));
    await insertContact(harness.database, contactInput(companyId, { name: "Second Contact" }));

    // Verify they exist
    const before = await harness.database.select().from(contacts);
    expect(before).toHaveLength(2);

    // Delete them
    await deleteContactsForCompany(harness.database, companyId);

    // Verify they're gone
    const after = await harness.database.select().from(contacts);
    expect(after).toHaveLength(0);
  });

  it("does not delete contacts for other companies", async () => {
    // Create a second company
    const otherCompany = await insertCompany(harness.database, companyInput());

    // Create contacts for both companies
    await insertContact(harness.database, contactInput(companyId));
    await insertContact(harness.database, contactInput(otherCompany.id));

    // Delete contacts for first company
    await deleteContactsForCompany(harness.database, companyId);

    // Verify only first company's contacts are gone
    const remaining = await harness.database.select().from(contacts);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.companyId).toBe(otherCompany.id);
  });
});

describe("do-not-contact markers", () => {
  it("stores the marker with its reason, time and acting account", async () => {
    const contact = await insertContact(
      harness.database,
      contactInput(companyId, { jobTitle: "Operations Director" }),
    );
    const actor = await insertAccount(harness.database, accountInput());

    const marked = await setContactDoNotContact(harness.database, {
      contactId: contact.id,
      reason: "Unsubscribe request",
      actorAccountId: actor.id,
    });

    expect(marked.doNotContactAt).toBeInstanceOf(Date);
    expect(marked.doNotContactReason).toBe("Unsubscribe request");
    expect(marked.doNotContactByAccountId).toBe(actor.id);
  });

  it("refuses a blank reason via the database", async () => {
    const contact = await insertContact(
      harness.database,
      contactInput(companyId, { jobTitle: "Operations Director" }),
    );

    const actor = await insertAccount(harness.database, accountInput());

    await expectConstraintViolation(
      harness.database
        .update(contacts)
        .set({
          doNotContactAt: new Date(),
          doNotContactReason: "   ",
          doNotContactByAccountId: actor.id,
        })
        .where(eq(contacts.id, contact.id)),
      "contacts_do_not_contact_requires_reason",
    );
  });

  it("clears the marker and its acting account", async () => {
    const contact = await insertContact(
      harness.database,
      contactInput(companyId, { jobTitle: "Operations Director" }),
    );
    const actor = await insertAccount(harness.database, accountInput());

    await setContactDoNotContact(harness.database, {
      contactId: contact.id,
      reason: "Unsubscribe request",
      actorAccountId: actor.id,
    });

    const cleared = await clearContactDoNotContact(harness.database, contact.id);

    expect(cleared.doNotContactAt).toBeNull();
    expect(cleared.doNotContactReason).toBeNull();
    expect(cleared.doNotContactByAccountId).toBeNull();
  });
});
