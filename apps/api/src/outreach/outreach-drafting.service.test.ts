import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AIService } from "@mela/ai";
import { hydrateEnvironment } from "@mela/config/env";
import {
  applyLeadStatusChange,
  getOutreach,
  insertAccount,
  insertAIInvocation,
  insertCompany,
  insertContact,
  insertLead,
  insertLeadResearchSummary,
  insertOpportunity,
  insertOpportunityAnalysisRun,
  insertOutreachDraft,
  insertWebsiteAnalysis,
  recordOutreachSend,
  setCompanyDoNotContact,
  setContactDoNotContact,
} from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { accountInput, companyInput, contactInput, leadInput } from "@mela/database/testing/fixtures";
import { eq } from "drizzle-orm";
import { DATABASE } from "../database/database.module";
import { OutreachDraftingService } from "./outreach-drafting.service";

describe("outreach-drafting service", () => {
  let harness: TestDatabase;
  let service: OutreachDraftingService;
  let companyId: string;
  let actorAccountId: string;

  beforeEach(async () => {
    hydrateEnvironment();

    harness = await setupTestDatabase();

    const actor = await insertAccount(harness.database, accountInput());
    actorAccountId = actor.id;

    const company = await insertCompany(harness.database, companyInput());
    companyId = company.id;

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
                subject: "Website modernization for Example Trading L.L.C.",
                body: "I noticed your site loads slowly on mobile.",
                claims: [{ text: "The site loads slowly on mobile.", cites: ["s1"] }],
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

  describe("draftOutreach citations", () => {
    it("resolves a claim's opportunity citation to a real source, and a summary citation to an explicit unresolved state", async () => {
      const company = await insertCompany(harness.database, companyInput());
      const contact = await insertContact(
        harness.database,
        contactInput(company.id, {
          email: "test@example.com",
          sourceUrl: "https://example.com/team",
        }),
      );
      const lead = await insertLead(harness.database, leadInput(company.id));

      const analysis = await insertWebsiteAnalysis(harness.database, {
        companyId: company.id,
        analysedUrl: "https://example.com",
        outcome: "completed",
      });

      const aiInvocation = await insertAIInvocation(harness.database, {
        promptName: "test",
        promptVersion: 1,
        model: "test",
        tier: "test",
        inputTokens: 1,
        outputTokens: 1,
        estimatedCostUsd: 0,
        latencyMs: 1,
        attempts: 1,
        outcome: "succeeded",
      });

      const run = await insertOpportunityAnalysisRun(harness.database, {
        companyId: company.id,
        websiteAnalysisId: analysis.id,
        promptVersion: 1,
        outcome: "opportunities",
        acceptedCount: 1,
        aiInvocationId: aiInvocation.id,
      });

      await insertOpportunity(harness.database, {
        analysisRunId: run.id,
        companyId: company.id,
        categoryId: "modernization",
        serviceId: "web_development",
        title: "Slow mobile site",
        description: "Pages take over ten seconds to load on mobile.",
        impact: "Visitors leave before the page finishes loading.",
        citedEvidence: ["t1"],
        aiInvocationId: aiInvocation.id,
      });

      await insertLeadResearchSummary(harness.database, {
        leadId: lead.id,
        companyId: company.id,
        sections: { business: [{ text: "Runs an e-commerce storefront.", cites: ["c1"] }] },
        citedFacts: ["c1"],
        promptVersion: 1,
        aiInvocationId: aiInvocation.id,
      });

      vi.mocked(service as any).aiService.run = vi.fn().mockResolvedValue({
        value: {
          subject: "Your mobile site speed",
          body: "I noticed your site loads slowly on mobile and that you run an online storefront.",
          claims: [
            { text: "Their site loads slowly on mobile.", cites: ["o1"] },
            { text: "They run an e-commerce storefront.", cites: ["s1"] },
          ],
        },
        invocationId: "invocation-2",
        promptVersion: 1,
      });

      const result = await service.draftOutreach({
        leadId: lead.id,
        contactId: contact.id,
        channelId: "email",
      });

      expect(result).not.toHaveProperty("reason");
      const outreachId = (result as { outreachId: string }).outreachId;

      const stored = await getOutreach(harness.database, outreachId);
      const citedFacts = stored?.citedFacts as Array<{
        text: string;
        citations: Array<{
          ref: string;
          detail: string;
          url: string | null;
          certainty: string | null;
        }>;
      }>;

      expect(citedFacts[0]?.citations[0]).toEqual({
        ref: "o1",
        detail: "Slow mobile site: Pages take over ten seconds to load on mobile.",
        url: "https://example.com",
        certainty: "inferred",
      });

      expect(citedFacts[1]?.citations[0]).toEqual({
        ref: "s1",
        detail:
          "Cites the lead's research summary; the specific source is not resolvable in this version.",
        url: null,
        certainty: null,
      });
    });
  });

  it("refuses when the lead has no current research summary", async () => {
    const lead = await insertLead(harness.database, leadInput(companyId));

    const result = await service.draftOutreach({
      leadId: lead.id,
      contactId: "contact-1",
      channelId: "email",
    });

    expect(result).toMatchObject({ reason: "Lead has no current research summary." });
  });

  describe("classifyResponse", () => {
    let outreachId: string;

    beforeEach(async () => {
      const lead = await insertLead(harness.database, leadInput(companyId));
      const draft = await insertOutreachDraft(harness.database, {
        leadId: lead.id,
        channel: "email",
        messageBody: "Example draft.",
        isExample: false,
      });
      outreachId = draft.id;
    });

    it("returns a grounded classification with basis and proposed transition", async () => {
      vi.mocked(service as any).aiService.run = vi.fn().mockResolvedValue({
        value: {
          categoryId: "interested",
          basisText: "interested in learning more",
          isClassified: true,
        },
        invocationId: "invocation-1",
        promptVersion: 1,
      });

      const result = await service.classifyResponse(
        outreachId,
        "I'm interested in learning more about your services.",
      );

      expect(result.categoryId).toBe("interested");
      expect(result.basisText).toBe("interested in learning more");
      expect(result.isClassified).toBe(true);
      expect(result.proposedTransition).toBe("interested");
    });

    it("discards an ungrounded classification and returns unclassified", async () => {
      vi.mocked(service as any).aiService.run = vi.fn().mockResolvedValue({
        value: {
          categoryId: "interested",
          basisText: "this phrase does not appear in the reply",
          isClassified: true,
        },
        invocationId: "invocation-1",
        promptVersion: 1,
      });

      const result = await service.classifyResponse(
        outreachId,
        "The reply text says something completely different.",
      );

      expect(result.categoryId).toBe("unclassified");
      expect(result.isClassified).toBe(false);
      expect(result.proposedTransition).toBeNull();
    });

    it("returns unclassified when the model selects it directly", async () => {
      vi.mocked(service as any).aiService.run = vi.fn().mockResolvedValue({
        value: {
          categoryId: "unclassified",
          basisText: "No suitable category.",
          isClassified: false,
        },
        invocationId: "invocation-1",
        promptVersion: 1,
      });

      const result = await service.classifyResponse(outreachId, "Random reply text.");

      expect(result.categoryId).toBe("unclassified");
      expect(result.isClassified).toBe(false);
      expect(result.proposedTransition).toBeNull();
    });
  });

  describe("recordResponse", () => {
    let outreachId: string;
    let leadId: string;

    beforeEach(async () => {
      const lead = await insertLead(harness.database, leadInput(companyId));
      leadId = lead.id;
      const draft = await insertOutreachDraft(harness.database, {
        leadId: lead.id,
        channel: "email",
        messageBody: "Example draft.",
        isExample: false,
      });
      outreachId = draft.id;
      const approval = await service.approveOutreach(outreachId, actorAccountId);
      await recordOutreachSend(harness.database, {
        outreachId,
        sentAt: new Date(approval.approvedAt!.getTime() + 1_000),
        means: "gmail",
        actorAccountId,
      });
      await applyLeadStatusChange(harness.database, leadId, "verified");
      await applyLeadStatusChange(harness.database, leadId, "analyzing");
      await applyLeadStatusChange(harness.database, leadId, "qualified");
      await applyLeadStatusChange(harness.database, leadId, "high_priority");
      await applyLeadStatusChange(harness.database, leadId, "contacted");
    });

    it("records the response and applies the lead transition", async () => {
      const result = await service.recordResponse(
        outreachId,
        {
          categoryId: "not_interested",
          receivedAt: new Date(Date.now() + 60_000),
          body: "Not interested.",
        },
        actorAccountId,
      );

      expect(result.outreachId).toBe(outreachId);
      expect(result.leadStatus).toBe("not_interested");
    });

    it("allows overriding the proposed category", async () => {
      const result = await service.recordResponse(
        outreachId,
        {
          categoryId: "not_interested",
          receivedAt: new Date(Date.now() + 60_000),
          body: "Not interested.",
        },
        actorAccountId,
      );

      expect(result.leadStatus).toBe("not_interested");
    });

    it("refuses an unknown category", async () => {
      await expect(
        service.recordResponse(
          outreachId,
          {
            categoryId: "unknown",
            receivedAt: new Date(Date.now() + 60_000),
          },
          actorAccountId,
        ),
      ).rejects.toThrow("Unknown response category");
    });

    it("refuses an impermissible transition", async () => {
      await expect(
        service.recordResponse(
          outreachId,
          {
            categoryId: "interested",
            receivedAt: new Date(Date.now() + 60_000),
          },
          actorAccountId,
        ),
      ).rejects.toThrow("Cannot move a lead from");
    });
  });

  describe("workflow", () => {
    it("approves, sends, classifies, confirms and moves the lead", async () => {
      const lead = await insertLead(harness.database, leadInput(companyId));
      const draft = await insertOutreachDraft(harness.database, {
        leadId: lead.id,
        channel: "email",
        messageBody: "Example draft.",
        isExample: false,
      });

      await service.approveOutreach(draft.id, actorAccountId);
      await recordOutreachSend(harness.database, {
        outreachId: draft.id,
        sentAt: new Date(Date.now() + 60_000),
        means: "gmail",
        actorAccountId,
      });
      await applyLeadStatusChange(harness.database, lead.id, "verified");
      await applyLeadStatusChange(harness.database, lead.id, "analyzing");
      await applyLeadStatusChange(harness.database, lead.id, "qualified");
      await applyLeadStatusChange(harness.database, lead.id, "high_priority");
      await applyLeadStatusChange(harness.database, lead.id, "contacted");

      vi.mocked(service as any).aiService.run = vi.fn().mockResolvedValue({
        value: {
          categoryId: "not_interested",
          basisText: "not interested",
          isClassified: true,
        },
        invocationId: "invocation-1",
        promptVersion: 1,
      });

      const classification = await service.classifyResponse(draft.id, "Not interested, thanks.");
      expect(classification.categoryId).toBe("unclassified");

      const response = await service.recordResponse(
        draft.id,
        {
          categoryId: "not_interested",
          receivedAt: new Date(Date.now() + 120_000),
          body: "Not interested, thanks.",
          proposedCategoryId: "not_interested",
        },
        actorAccountId,
      );

      expect(response.leadStatus).toBe("not_interested");
    });
  });

  describe("recordNoResponse", () => {
    let outreachId: string;

    beforeEach(async () => {
      const lead = await insertLead(harness.database, leadInput(companyId));
      const draft = await insertOutreachDraft(harness.database, {
        leadId: lead.id,
        channel: "email",
        messageBody: "Example draft.",
        isExample: false,
      });
      outreachId = draft.id;
      const approved = await service.approveOutreach(outreachId, actorAccountId);
      await recordOutreachSend(harness.database, {
        outreachId,
        sentAt: new Date(approved.approvedAt!.getTime() + 1_000),
        means: "gmail",
        actorAccountId,
      });
    });

    it("records a no-response after the interval", async () => {
      const result = await service.recordNoResponse(
        outreachId,
        new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      );

      expect(result.outreachId).toBe(outreachId);
      expect(result.responseId).toBeDefined();
    });

    it("refuses a no-response before the interval", async () => {
      await expect(service.recordNoResponse(outreachId, new Date())).rejects.toThrow(
        "No-response can only be recorded after 14 days.",
      );
    });
  });

  describe("do-not-contact", () => {
    it("refuses drafting for a marked company", async () => {
      const company = await insertCompany(harness.database, companyInput());
      await setCompanyDoNotContact(harness.database, {
        companyId: company.id,
        reason: "Unsubscribe request",
        actorAccountId,
      });

      const lead = await insertLead(harness.database, leadInput(company.id));
      const contact = await insertContact(
        harness.database,
        contactInput(company.id, {
          email: "test@example.com",
          sourceUrl: "https://example.com/contact",
        }),
      );
      const aiInvocation = await insertAIInvocation(harness.database, {
        promptName: "test",
        promptVersion: 1,
        model: "test",
        tier: "test",
        inputTokens: 1,
        outputTokens: 1,
        estimatedCostUsd: 0,
        latencyMs: 1,
        attempts: 1,
        outcome: "succeeded",
      });
      await insertLeadResearchSummary(harness.database, {
        leadId: lead.id,
        companyId: company.id,
        sections: { business: [{ text: "Test", cites: ["c1"] }] },
        citedFacts: ["c1"],
        promptVersion: 1,
        aiInvocationId: aiInvocation.id,
      });

      const result = await service.draftOutreach({
        leadId: lead.id,
        contactId: contact.id,
        channelId: "email",
      });

      expect(result).toMatchObject({ reason: `Company ${company.id} is marked do-not-contact.` });
    });

    it("refuses drafting for a marked contact", async () => {
      const company = await insertCompany(harness.database, companyInput());
      const contact = await insertContact(
        harness.database,
        contactInput(company.id, {
          email: "test@example.com",
          sourceUrl: "https://example.com/contact",
        }),
      );
      await setContactDoNotContact(harness.database, {
        contactId: contact.id,
        reason: "Unsubscribe request",
        actorAccountId,
      });

      const lead = await insertLead(harness.database, leadInput(company.id));
      const aiInvocation = await insertAIInvocation(harness.database, {
        promptName: "test",
        promptVersion: 1,
        model: "test",
        tier: "test",
        inputTokens: 1,
        outputTokens: 1,
        estimatedCostUsd: 0,
        latencyMs: 1,
        attempts: 1,
        outcome: "succeeded",
      });
      await insertLeadResearchSummary(harness.database, {
        leadId: lead.id,
        companyId: company.id,
        sections: { business: [{ text: "Test", cites: ["c1"] }] },
        citedFacts: ["c1"],
        promptVersion: 1,
        aiInvocationId: aiInvocation.id,
      });

      const result = await service.draftOutreach({
        leadId: lead.id,
        contactId: contact.id,
        channelId: "email",
      });

      expect(result).toMatchObject({ reason: `Contact ${contact.id} is marked do-not-contact.` });
    });

    it("sets company do-not-contact on unsubscribe", async () => {
      const company = await insertCompany(harness.database, companyInput());
      const lead = await insertLead(harness.database, leadInput(company.id));
      const draft = await insertOutreachDraft(harness.database, {
        leadId: lead.id,
        channel: "email",
        messageBody: "Example draft.",
        isExample: false,
      });
      await service.approveOutreach(draft.id, actorAccountId);
      await recordOutreachSend(harness.database, {
        outreachId: draft.id,
        sentAt: new Date(Date.now() + 60_000),
        means: "gmail",
        actorAccountId,
      });
      await applyLeadStatusChange(harness.database, lead.id, "verified");
      await applyLeadStatusChange(harness.database, lead.id, "analyzing");
      await applyLeadStatusChange(harness.database, lead.id, "qualified");
      await applyLeadStatusChange(harness.database, lead.id, "high_priority");
      await applyLeadStatusChange(harness.database, lead.id, "contacted");

      await service.recordResponse(
        draft.id,
        {
          categoryId: "unsubscribe",
          receivedAt: new Date(Date.now() + 120_000),
        },
        actorAccountId,
      );

      const [updatedCompany] = await harness.database
        .select()
        .from(require("@mela/database").companies)
        .where(eq(require("@mela/database").companies.id, company.id))
        .limit(1);

      expect(updatedCompany!.doNotContactAt).toBeInstanceOf(Date);
      expect(updatedCompany!.doNotContactReason).toBe("Unsubscribe request");
    });
  });
});
