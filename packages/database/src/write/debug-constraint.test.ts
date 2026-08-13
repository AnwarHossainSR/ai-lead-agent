import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { outreach } from "../schema/outreach";
import { companyInput, leadInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { insertCompany } from "./companies";
import { WriteValidationError } from "./errors";
import { insertLead } from "./leads";
import { approveOutreach, insertOutreachDraft } from "./outreach";

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

describe("debug constraint error", () => {
  it("logs the error structure", async () => {
    const draft = await insertOutreachDraft(harness.database, {
      leadId,
      channel: "email",
      messageBody: "Example draft.",
    });

    await approveOutreach(harness.database, draft.id);

    try {
      await harness.database
        .update(outreach)
        .set({ status: "sent", sentAt: new Date(), sentMeans: null })
        .where(eq(outreach.id, draft.id));
    } catch (error) {
      console.log("Error:", JSON.stringify(error, null, 2));
      throw error;
    }
  });
});
