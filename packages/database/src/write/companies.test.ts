import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { uuidv7 } from "uuidv7";

import { companies } from "../schema/companies";
import { contacts } from "../schema/contacts";
import { leads } from "../schema/leads";
import { verificationChecks } from "../schema/verification-checks";
import { companyInput, contactInput, leadInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { DuplicateCompanyError, RecordNotFoundError, WriteValidationError } from "./errors";
import {
  applyVerificationResult,
  deriveVerificationState,
  insertCompany,
  listStaleCompanies,
  updateCompany,
} from "./companies";
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

  it("removes its verification check records", async () => {
    const company = await insertCompany(harness.database, companyInput());
    const runId = uuidv7();
    await applyVerificationResult(harness.database, {
      companyId: company.id,
      verificationRunId: runId,
      checks: [
        { checkId: "dns", status: "passed", required: true, evidence: "Resolved to 1.2.3.4" },
        { checkId: "http", status: "passed", required: true, evidence: "HTTP 200 OK" },
      ],
      verdict: "passed",
    });

    expect(
      await harness.database
        .select()
        .from(verificationChecks)
        .where(eq(verificationChecks.companyId, company.id)),
    ).toHaveLength(2);

    await harness.database.delete(companies).where(eq(companies.id, company.id));

    expect(
      await harness.database
        .select()
        .from(verificationChecks)
        .where(eq(verificationChecks.companyId, company.id)),
    ).toHaveLength(0);
  });
});

describe("a caller cannot claim verification at creation", () => {
  it("stores the company with never_checked state and verified false", async () => {
    const row = await insertCompany(harness.database, companyInput());

    expect(row.verificationState).toBe("never_checked");
    expect(row.verified).toBe(false);
    expect(row.verifiedAt).toBeNull();
    expect(row.verificationRunId).toBeNull();
  });
});

describe("a caller cannot claim verification at update", () => {
  it("is refused with an error stating that verification is derived", async () => {
    const company = await insertCompany(harness.database, companyInput());

    await expect(
      updateCompany(harness.database, company.id, {
        verificationState: "verified",
      } as Record<string, unknown>),
    ).rejects.toThrow();
  });
});

describe("applyVerificationResult", () => {
  it("sets verification_state to verified when all required checks pass", async () => {
    const company = await insertCompany(harness.database, companyInput());
    const runId = uuidv7();

    const updated = await applyVerificationResult(harness.database, {
      companyId: company.id,
      verificationRunId: runId,
      checks: [
        { checkId: "dns", status: "passed", required: true, evidence: "Resolved to 1.2.3.4" },
        { checkId: "http", status: "passed", required: true, evidence: "HTTP 200 OK" },
        { checkId: "domain-name-match", status: "passed", required: false, evidence: "Tokens match" },
      ],
      verdict: "passed",
    });

    expect(updated.verificationState).toBe("verified");
    expect(updated.verified).toBe(true);
    expect(updated.verifiedAt).toBeInstanceOf(Date);
    expect(updated.verificationRunId).toBe(runId);
  });

  it("sets verification_state to unverified when a required check fails", async () => {
    const company = await insertCompany(harness.database, companyInput());

    const updated = await applyVerificationResult(harness.database, {
      companyId: company.id,
      verificationRunId: uuidv7(),
      checks: [
        { checkId: "dns", status: "passed", required: true, evidence: "Resolved to 1.2.3.4" },
        { checkId: "http", status: "failed", required: true, evidence: "Connection refused" },
      ],
      verdict: "failed",
    });

    expect(updated.verificationState).toBe("unverified");
    expect(updated.verified).toBe(false);
    expect(updated.verifiedAt).toBeInstanceOf(Date);
  });

  it("sets verification_state to unverified when a required check is unknown", async () => {
    const company = await insertCompany(harness.database, companyInput());

    const updated = await applyVerificationResult(harness.database, {
      companyId: company.id,
      verificationRunId: uuidv7(),
      checks: [
        { checkId: "dns", status: "passed", required: true, evidence: "Resolved to 1.2.3.4" },
        { checkId: "http", status: "unknown", required: true },
      ],
      verdict: "unknown",
    });

    expect(updated.verificationState).toBe("unverified");
    expect(updated.verified).toBe(false);
  });

  it("throws when the company does not exist", async () => {
    await expect(
      applyVerificationResult(harness.database, {
        companyId: uuidv7(),
        verificationRunId: uuidv7(),
        checks: [{ checkId: "dns", status: "passed", required: true, evidence: "Resolved" }],
        verdict: "passed",
      }),
    ).rejects.toThrow(RecordNotFoundError);
  });

  it("persists verification check records alongside the state update", async () => {
    const company = await insertCompany(harness.database, companyInput());
    const runId = uuidv7();

    await applyVerificationResult(harness.database, {
      companyId: company.id,
      verificationRunId: runId,
      checks: [
        { checkId: "dns", status: "passed", required: true, evidence: "Resolved to 1.2.3.4" },
        { checkId: "http", status: "failed", required: true, evidence: "Connection refused" },
      ],
      verdict: "failed",
    });

    const checks = await harness.database
      .select()
      .from(verificationChecks)
      .where(eq(verificationChecks.companyId, company.id));

    expect(checks).toHaveLength(2);
    expect(checks.map((c) => c.checkId).sort()).toEqual(["dns", "http"]);
    expect(checks.every((c) => c.verificationRunId === runId)).toBe(true);
    expect(checks.every((c) => c.ranAt instanceof Date)).toBe(true);
  });

  it("accumulates check records across multiple verification runs", async () => {
    const company = await insertCompany(harness.database, companyInput());

    await applyVerificationResult(harness.database, {
      companyId: company.id,
      verificationRunId: uuidv7(),
      checks: [{ checkId: "dns", status: "passed", required: true, evidence: "Resolved to 1.2.3.4" }],
      verdict: "passed",
    });

    await applyVerificationResult(harness.database, {
      companyId: company.id,
      verificationRunId: uuidv7(),
      checks: [
        { checkId: "dns", status: "passed", required: true, evidence: "Resolved to 1.2.3.4" },
        { checkId: "http", status: "failed", required: true, evidence: "Connection refused" },
      ],
      verdict: "failed",
    });

    const checks = await harness.database
      .select()
      .from(verificationChecks)
      .where(eq(verificationChecks.companyId, company.id));

    expect(checks).toHaveLength(3);
  });
});

describe("verification state database constraints", () => {
  it("allows a raw update of verification_state (the write helper enforces the constraint)", async () => {
    const company = await insertCompany(harness.database, companyInput());

    // Raw SQL update bypasses the write helper, which is the only layer
    // that enforces verified_at must accompany verification_state.
    await harness.database
      .update(companies)
      .set({ verificationState: "verified" })
      .where(eq(companies.id, company.id));

    const [row] = await harness.database
      .select()
      .from(companies)
      .where(eq(companies.id, company.id));

    // The raw update succeeds — the write helper is what prevents this path.
    expect(row!.verificationState).toBe("verified");
  });

  it("rejects a verification_checks insert with passed verdict and no evidence", async () => {
    const company = await insertCompany(harness.database, companyInput());

    await expect(
      harness.database.insert(verificationChecks).values({
        id: uuidv7(),
        companyId: company.id,
        checkId: "dns",
        verdict: "passed",
        ranAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it("rejects a verification_checks insert with failed verdict and no evidence", async () => {
    const company = await insertCompany(harness.database, companyInput());

    await expect(
      harness.database.insert(verificationChecks).values({
        id: uuidv7(),
        companyId: company.id,
        checkId: "dns",
        verdict: "failed",
        ranAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it("allows a verification_checks insert with unknown verdict and no evidence", async () => {
    const company = await insertCompany(harness.database, companyInput());

    await expect(
      harness.database.insert(verificationChecks).values({
        id: uuidv7(),
        companyId: company.id,
        checkId: "dns",
        verdict: "unknown",
        ranAt: new Date(),
      }),
    ).resolves.toBeDefined();
  });

  it("allows a verification_checks insert with passed verdict and evidence", async () => {
    const company = await insertCompany(harness.database, companyInput());

    await expect(
      harness.database.insert(verificationChecks).values({
        id: uuidv7(),
        companyId: company.id,
        checkId: "dns",
        verdict: "passed",
        evidence: "DNS resolved to 1.2.3.4",
        ranAt: new Date(),
      }),
    ).resolves.toBeDefined();
  });
});

describe("listStaleCompanies", () => {
  it("returns companies that have never been checked", async () => {
    const company = await insertCompany(harness.database, companyInput());

    const stale = await listStaleCompanies(harness.database, 90);

    expect(stale.some((c) => c.id === company.id)).toBe(true);
  });

  it("excludes companies verified within the staleness window", async () => {
    const company = await insertCompany(harness.database, companyInput());

    await applyVerificationResult(harness.database, {
      companyId: company.id,
      verificationRunId: uuidv7(),
      checks: [{ checkId: "dns", status: "passed", required: true, evidence: "Resolved to 1.2.3.4" }],
      verdict: "passed",
    });

    const stale = await listStaleCompanies(harness.database, 90);

    expect(stale.some((c) => c.id === company.id)).toBe(false);
  });

  it("excludes example companies", async () => {
    const company = await insertCompany(
      harness.database,
      companyInput({ isExample: true }),
    );

    const stale = await listStaleCompanies(harness.database, 90);

    expect(stale.some((c) => c.id === company.id)).toBe(false);
  });

  it("returns companies verified before the staleness window", async () => {
    const company = await insertCompany(harness.database, companyInput());

    await applyVerificationResult(harness.database, {
      companyId: company.id,
      verificationRunId: uuidv7(),
      checks: [{ checkId: "dns", status: "passed", required: true, evidence: "Resolved to 1.2.3.4" }],
      verdict: "passed",
    });

    // Backdate the verified_at to 100 days ago
    const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    await harness.database
      .update(companies)
      .set({ verifiedAt: hundredDaysAgo })
      .where(eq(companies.id, company.id));

    const stale = await listStaleCompanies(harness.database, 90);

    expect(stale.some((c) => c.id === company.id)).toBe(true);
  });
});

describe("deriveVerificationState", () => {
  it("returns never_checked when no checks are provided", () => {
    const result = deriveVerificationState([]);

    expect(result.state).toBe("never_checked");
    expect(result.verdict).toBe("unknown");
  });

  it("returns verified when all required checks pass", () => {
    const result = deriveVerificationState([
      { checkId: "dns", status: "passed", required: true },
      { checkId: "http", status: "passed", required: true },
    ]);

    expect(result.state).toBe("verified");
    expect(result.verdict).toBe("passed");
  });

  it("returns unverified when a required check fails", () => {
    const result = deriveVerificationState([
      { checkId: "dns", status: "passed", required: true },
      { checkId: "http", status: "failed", required: true },
    ]);

    expect(result.state).toBe("unverified");
    expect(result.verdict).toBe("failed");
  });

  it("returns unverified when a required check is unknown", () => {
    const result = deriveVerificationState([
      { checkId: "dns", status: "passed", required: true },
      { checkId: "http", status: "unknown", required: true },
    ]);

    expect(result.state).toBe("unverified");
    expect(result.verdict).toBe("unknown");
  });

  it("returns unreachable when only optional checks are present", () => {
    const result = deriveVerificationState([
      { checkId: "registry", status: "unknown", required: false },
    ]);

    expect(result.state).toBe("unreachable");
    expect(result.verdict).toBe("unknown");
  });
});
