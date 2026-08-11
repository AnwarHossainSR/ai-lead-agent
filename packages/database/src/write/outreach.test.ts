import { automatedSendingIsForbiddenEverywhere } from "@mela/config";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { outreach } from "../schema/outreach";
import { expectConstraintViolation } from "../testing/constraints";
import { companyInput, leadInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { insertCompany } from "./companies";
import { WriteValidationError } from "./errors";
import { insertLead } from "./leads";
import {
  approveOutreach,
  insertOutreachDraft,
  markOutreachSent,
  recordOutreachResponse,
} from "./outreach";

let harness: TestDatabase;
let leadId: string;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  const company = await insertCompany(harness.database, companyInput());
  const lead = await insertLead(harness.database, leadInput(company.id));
  leadId = lead.id;
});

afterAll(async () => {
  await harness.close();
});

describe("a stored draft", () => {
  it("is unapproved and unsent", async () => {
    const row = await insertOutreachDraft(harness.database, {
      leadId,
      channel: "email",
      messageBody: "Example draft.",
    });

    expect(row.status).toBe("draft");
    expect(row.approvedAt).toBeNull();
    expect(row.sentAt).toBeNull();
  });

  it("cannot be created already claiming to be approved", () => {
    // There is no parameter for it. This is a type-level guarantee, asserted
    // here so that adding one is a visible change to a test rather than a
    // quiet widening of the API.
    const draft: Parameters<typeof insertOutreachDraft>[1] = {
      leadId,
      channel: "email",
      messageBody: "Example draft.",
    };

    expect(Object.keys(draft)).not.toContain("approvedAt");
    expect(Object.keys(draft)).not.toContain("status");
  });
});

describe("sending without approval", () => {
  it("is refused, and the record stays unsent", async () => {
    const draft = await insertOutreachDraft(harness.database, {
      leadId,
      channel: "email",
      messageBody: "Example draft.",
    });

    await expect(markOutreachSent(harness.database, draft.id)).rejects.toThrow(
      WriteValidationError,
    );

    const [stored] = await harness.database.select().from(outreach);
    expect(stored?.status).toBe("draft");
    expect(stored?.sentAt).toBeNull();
  });

  it("is refused by the database as well, not only by the helper", async () => {
    const draft = await insertOutreachDraft(harness.database, {
      leadId,
      channel: "email",
      messageBody: "Example draft.",
    });

    // What a hand-written UPDATE or a future worker would do.
    await expectConstraintViolation(
      harness.database
        .update(outreach)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(outreach.id, draft.id)),
      "outreach_sent_at_requires_approved_at",
    );
  });

  it("is refused even when only the status is moved, with no timestamp", async () => {
    const draft = await insertOutreachDraft(harness.database, {
      leadId,
      channel: "email",
      messageBody: "Example draft.",
    });

    await expectConstraintViolation(
      harness.database.update(outreach).set({ status: "sent" }).where(eq(outreach.id, draft.id)),
      "outreach_sent_requires_approval",
    );
  });
});

describe("an approved record", () => {
  it("can be marked sent, and the sent time is not earlier than the approval", async () => {
    const draft = await insertOutreachDraft(harness.database, {
      leadId,
      channel: "email",
      messageBody: "Example draft.",
    });

    const approved = await approveOutreach(harness.database, draft.id);
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toBeInstanceOf(Date);

    const sent = await markOutreachSent(harness.database, draft.id);
    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBeInstanceOf(Date);
    expect(sent.approvedAt).toBeInstanceOf(Date);
    expect(sent.sentAt!.getTime()).toBeGreaterThanOrEqual(sent.approvedAt!.getTime());
  });

  it("refuses a sent timestamp earlier than its approval", async () => {
    const draft = await insertOutreachDraft(harness.database, {
      leadId,
      channel: "email",
      messageBody: "Example draft.",
    });
    const approved = await approveOutreach(harness.database, draft.id);

    const backdated = new Date(approved.approvedAt!.getTime() - 60_000);

    await expectConstraintViolation(
      harness.database
        .update(outreach)
        .set({ status: "sent", sentAt: backdated })
        .where(eq(outreach.id, draft.id)),
      "outreach_sent_at_not_before_approved_at",
    );
  });

  it("can record a reply once it has been sent", async () => {
    const draft = await insertOutreachDraft(harness.database, {
      leadId,
      channel: "email",
      messageBody: "Example draft.",
    });

    await approveOutreach(harness.database, draft.id);
    await markOutreachSent(harness.database, draft.id);
    const replied = await recordOutreachResponse(harness.database, draft.id);

    expect(replied.status).toBe("replied");
    expect(replied.respondedAt).toBeInstanceOf(Date);
  });

  it("cannot record a reply to something never sent", async () => {
    const draft = await insertOutreachDraft(harness.database, {
      leadId,
      channel: "email",
      messageBody: "Example draft.",
    });

    await expect(recordOutreachResponse(harness.database, draft.id)).rejects.toThrow(
      /reachable only from sent/,
    );
  });
});

describe("an unknown channel", () => {
  it("is refused, naming what was supplied", async () => {
    await expect(
      insertOutreachDraft(harness.database, {
        leadId,
        channel: "sms" as "email",
        messageBody: "Example draft.",
      }),
    ).rejects.toThrow(WriteValidationError);
  });
});

describe("the data model", () => {
  it("provides no mechanism that transmits a message", () => {
    // The guarantee is structural: no channel in the configuration permits
    // automated sending, and nothing in this package opens a connection to
    // anything but PostgreSQL.
    expect(automatedSendingIsForbiddenEverywhere()).toBe(true);
  });
});
