import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectConstraintViolation, expectErrorMatching } from "../testing/constraints";
import { accountInput, companyInput, leadInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import {
  changeAccountRole,
  disableAccount,
  findAccountByEmailWithHash,
  getAccount,
  insertAccount,
  listAccounts,
} from "./accounts";
import { insertAuditEntry, listAuditEntries } from "./audit-log";
import { insertCompany } from "./companies";
import { RecordNotFoundError, WriteValidationError } from "./errors";
import { insertLead } from "./leads";
import { approveOutreach, insertOutreachDraft } from "./outreach";
import { findSessionByTokenHash, insertSession, revokeSession } from "./sessions";

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

describe("accounts (specs/lead-data-model: accounts, sessions and audit entries are persisted)", () => {
  it("stores a unique identifier, email, role, disabled marker and timestamps", async () => {
    const row = await insertAccount(harness.database, accountInput({ role: "viewer" }));

    expect(row.id).toBeDefined();
    expect(row.role).toBe("viewer");
    expect(row.disabledAt).toBeNull();
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("refuses a duplicate email", async () => {
    const input = accountInput({ email: "duplicate@example.com" });
    await insertAccount(harness.database, input);

    await expect(insertAccount(harness.database, input)).rejects.toThrow(WriteValidationError);
  });

  it("refuses an unrecognised role at the database", async () => {
    await expect(
      harness.database.execute(sql`
        INSERT INTO accounts (id, email, password_hash, role)
        VALUES (${uuidv7()}, 'bad-role@example.com', 'hash', 'superadmin')
      `),
    ).rejects.toThrow();
  });

  it("never returns a password hash from a read helper", async () => {
    const created = await insertAccount(harness.database, accountInput());

    const byId = await getAccount(harness.database, created.id);
    const listed = await listAccounts(harness.database);

    expect(byId).not.toHaveProperty("passwordHash");
    expect(listed[0]).not.toHaveProperty("passwordHash");
  });

  it("returns the password hash only through the sign-in read path", async () => {
    const created = await insertAccount(
      harness.database,
      accountInput({ email: "signin@example.com", passwordHash: "a-real-looking-hash" }),
    );

    const row = await findAccountByEmailWithHash(harness.database, "signin@example.com");

    expect(row?.id).toBe(created.id);
    expect(row?.passwordHash).toBe("a-real-looking-hash");
  });

  it("changes a role", async () => {
    const created = await insertAccount(harness.database, accountInput({ role: "viewer" }));

    const updated = await changeAccountRole(harness.database, created.id, "operator");

    expect(updated.role).toBe("operator");
  });

  it("disabling an account ends its sessions", async () => {
    const created = await insertAccount(harness.database, accountInput());
    const session = await insertSession(harness.database, {
      accountId: created.id,
      tokenHash: "token-hash-for-disable-test",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const disabled = await disableAccount(harness.database, created.id);
    const found = await findSessionByTokenHash(harness.database, "token-hash-for-disable-test");

    expect(disabled.disabledAt).toBeInstanceOf(Date);
    expect(found?.id).toBe(session.id);
    expect(found?.revokedAt).toBeInstanceOf(Date);
  });

  it("throws for a disable of an unknown account", async () => {
    await expect(disableAccount(harness.database, uuidv7())).rejects.toThrow(RecordNotFoundError);
  });

  it("attribution survives the acting account being disabled (design D5)", async () => {
    const actor = await insertAccount(harness.database, accountInput());
    const company = await insertCompany(harness.database, companyInput());
    const lead = await insertLead(harness.database, leadInput(company.id));
    const draft = await insertOutreachDraft(harness.database, {
      leadId: lead.id,
      channel: "email",
      messageBody: "Example draft.",
      isExample: false,
    });

    const approved = await approveOutreach(harness.database, draft.id, actor.id);
    await disableAccount(harness.database, actor.id);

    expect(approved.approvedByAccountId).toBe(actor.id);
    const stillAttributed = await getAccount(harness.database, actor.id);
    expect(stillAttributed?.disabledAt).toBeInstanceOf(Date);
    expect(stillAttributed?.id).toBe(actor.id);
  });

  it("refuses to delete an account a record still attributes an action to (design D5's ON DELETE RESTRICT)", async () => {
    const actor = await insertAccount(harness.database, accountInput());
    const company = await insertCompany(harness.database, companyInput());
    const lead = await insertLead(harness.database, leadInput(company.id));
    const draft = await insertOutreachDraft(harness.database, {
      leadId: lead.id,
      channel: "email",
      messageBody: "Example draft.",
      isExample: false,
    });

    await approveOutreach(harness.database, draft.id, actor.id);

    await expectConstraintViolation(
      harness.database.execute(sql`DELETE FROM accounts WHERE id = ${actor.id}`),
      "outreach_approved_by_account_id_accounts_id_fk",
    );
  });
});

describe("sessions (specs/lead-data-model: expired and revoked sessions are distinguishable)", () => {
  it("keeps expiry and revocation as independent, readable states", async () => {
    const account = await insertAccount(harness.database, accountInput());

    const expired = await insertSession(harness.database, {
      accountId: account.id,
      tokenHash: "expired-token-hash",
      expiresAt: new Date(Date.now() - 60_000),
    });
    const active = await insertSession(harness.database, {
      accountId: account.id,
      tokenHash: "active-token-hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const revoked = await revokeSession(harness.database, active.id);

    expect(expired.expiresAt.getTime()).toBeLessThan(Date.now());
    expect(expired.revokedAt).toBeNull();
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    expect(revoked.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("audit log (specs/lead-data-model: audit entries are append-only)", () => {
  it("stores an entry with its account, event and outcome", async () => {
    const account = await insertAccount(harness.database, accountInput());

    const entry = await insertAuditEntry(harness.database, {
      accountId: account.id,
      event: "sign_in",
      outcome: "succeeded",
    });

    expect(entry.accountId).toBe(account.id);
    expect(entry.event).toBe("sign_in");
    expect(entry.outcome).toBe("succeeded");
  });

  it("refuses an update through the database", async () => {
    const entry = await insertAuditEntry(harness.database, {
      event: "sign_in",
      outcome: "succeeded",
    });

    await expectErrorMatching(
      harness.database.execute(
        sql`UPDATE audit_log SET outcome = 'tampered' WHERE id = ${entry.id}`,
      ),
      /append-only/,
    );
  });

  it("refuses a delete through the database", async () => {
    const entry = await insertAuditEntry(harness.database, {
      event: "sign_in",
      outcome: "succeeded",
    });

    await expectErrorMatching(
      harness.database.execute(sql`DELETE FROM audit_log WHERE id = ${entry.id}`),
      /append-only/,
    );
  });

  it("outlives the account it refers to", async () => {
    const account = await insertAccount(harness.database, accountInput());
    const entry = await insertAuditEntry(harness.database, {
      accountId: account.id,
      event: "sign_in",
      outcome: "succeeded",
    });

    await harness.database.execute(sql`DELETE FROM accounts WHERE id = ${account.id}`);

    const [remaining] = await listAuditEntries(harness.database, { event: "sign_in" });

    expect(remaining?.id).toBe(entry.id);
    expect(remaining?.accountId).toBeNull();
  });

  it("lists entries newest first, filtered by event", async () => {
    const first = await insertAuditEntry(harness.database, {
      event: "sign_in",
      outcome: "succeeded",
    });
    await insertAuditEntry(harness.database, { event: "sign_out", outcome: "succeeded" });
    const third = await insertAuditEntry(harness.database, {
      event: "sign_in",
      outcome: "failed",
    });

    const entries = await listAuditEntries(harness.database, { event: "sign_in" });

    expect(entries.map((row) => row.id)).toEqual([third.id, first.id]);
    expect(entries.every((row) => row.event === "sign_in")).toBe(true);
  });

  it("never carries a password, hash, session id or model prompt in its detail", async () => {
    const entry = await insertAuditEntry(harness.database, {
      event: "sign_in_failed",
      outcome: "failed",
      detail: { reason: "invalid_credentials" },
    });

    const serialized = JSON.stringify(entry.detail);

    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/hash/i);
    expect(serialized).not.toMatch(/session/i);
    expect(serialized).not.toMatch(/prompt/i);
  });
});
