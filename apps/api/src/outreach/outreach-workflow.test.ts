import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AIService } from "@mela/ai";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { companyInput, leadInput } from "@mela/database/testing/fixtures";
import { insertCompany, insertLead, insertOutreachDraft } from "@mela/database";
import { DATABASE } from "../database/database.module";
import { OutreachDraftingService } from "./outreach-drafting.service";

describe("outreach workflow", () => {
  let harness: TestDatabase;
  let service: OutreachDraftingService;
  let companyId: string;
  let leadId: string;
  let outreachId: string;

  beforeEach(async () => {
    harness = await setupTestDatabase();

    const company = await insertCompany(harness.database, companyInput());
    companyId = company.id;

    const lead = await insertLead(harness.database, leadInput(companyId));
    leadId = lead.id;

    const draft = await insertOutreachDraft(harness.database, {
      leadId,
      channel: "email",
      messageBody: "Original body.",
      notes: "Workflow test draft",
      isExample: false,
    });
    outreachId = draft.id;

    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DATABASE,
          useValue: harness.database,
        },
        {
          provide: "AI_SERVICE",
          useValue: {
            run: vi.fn().mockResolvedValue({
              value: {
                subject: "Website modernization",
                body: "I noticed your site loads slowly.",
                claims: [{ text: "The site loads slowly.", cites: ["s1"] }],
              },
              invocationId: "invocation-1",
              promptVersion: 1,
            }),
          } satisfies Partial<AIService>,
        },
        OutreachDraftingService,
      ],
    }).compile();

    service = moduleRef.get(OutreachDraftingService);
  });

  afterEach(async () => {
    await harness.close();
  });

  it("submits, approves, edits and re-approves a draft", async () => {
    const submitted = await service.submitOutreach(outreachId);
    expect(submitted.status).toBe("pending_approval");

    const approved = await service.approveOutreach(outreachId);
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toBeInstanceOf(Date);

    const updated = await service.updateOutreach(outreachId, { messageBody: "Updated body." });
    expect(updated.status).toBe("draft");
    expect(updated.approvedAt).toBeNull();
    expect(updated.approvalRevokedAt).toBeInstanceOf(Date);

    const reapproved = await service.approveOutreach(outreachId);
    expect(reapproved.status).toBe("approved");
    expect(reapproved.approvedAt).toBeInstanceOf(Date);
  });

  it("rejects a pending approval with a reason", async () => {
    await service.submitOutreach(outreachId);

    const rejected = await service.rejectOutreach(outreachId, "Too generic.");

    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectionReason).toBe("Too generic.");
    expect(rejected.rejectedAt).toBeInstanceOf(Date);
  });

  it("cancels a draft", async () => {
    const cancelled = await service.cancelOutreach(outreachId);

    expect(cancelled.status).toBe("cancelled");
  });

  it("lists outreach filtered by status", async () => {
    const all = await service.listOutreach({ leadId });
    expect(all).toHaveLength(1);

    const drafts = await service.listOutreach({ leadId, status: "draft" });
    expect(drafts).toHaveLength(1);

    const sent = await service.listOutreach({ leadId, status: "sent" });
    expect(sent).toHaveLength(0);
  });

  it("refuses to approve from a non-draft state", async () => {
    await service.submitOutreach(outreachId);
    await service.rejectOutreach(outreachId, "Too generic.");

    await expect(service.approveOutreach(outreachId)).rejects.toThrow();
  });
});
