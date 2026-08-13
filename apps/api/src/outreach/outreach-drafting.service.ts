import { Inject, Injectable } from "@nestjs/common";

import type { AIService } from "@mela/ai";
import type { OutreachDraftingOutput } from "@mela/ai";
import { outreachResponseClassificationInputSchema } from "@mela/ai";
import type { OutreachResponseClassificationOutput } from "@mela/ai";
import {
  DEFAULT_RESPONSE_CATEGORIES,
  NO_RESPONSE_INTERVAL_DAYS,
  OUTREACH_CHANNELS,
  type OutreachChannelId,
} from "@mela/config";
import type { Database, OutreachRow } from "@mela/database";
import {
  type LeadRow,
  applyLeadStatusChange,
  approveOutreach,
  cancelOutreach,
  clearCompanyDoNotContact,
  clearContactDoNotContact,
  getCurrentLeadResearchSummary,
  insertOutreachDraft,
  insertOutreachResponse,
  listOutreach,
  recordOutreachSend,
  rejectOutreach,
  setCompanyDoNotContact,
  setContactDoNotContact,
  submitOutreachForApproval,
  updateOutreachText,
} from "@mela/database";
import { eq } from "drizzle-orm";
import { DATABASE } from "../database/database.module";
import { screenOutreachDraft } from "./outreach-drafting.grounding";
import {
  type OutreachDraftingFacts,
  assembleOutreachDraftingInput,
} from "./outreach-drafting.input";

export interface DraftOutreachInput {
  readonly leadId: string;
  readonly contactId: string;
  readonly channelId: string;
}

export interface DraftOutreachResult {
  readonly outreachId: string;
  readonly promptVersion: number;
  readonly aiInvocationId: string;
  readonly subject: string;
  readonly body: string;
  readonly rejections: readonly { category: string; reason: string }[];
}

export interface DraftOutreachRefusal {
  readonly reason: string;
}

export type DraftOutreachResponse = DraftOutreachResult | DraftOutreachRefusal;

export interface ClassifyResponseResult {
  readonly outreachId: string;
  readonly categoryId: string;
  readonly basisText: string;
  readonly isClassified: boolean;
  readonly proposedTransition: string | null;
}

@Injectable()
export class OutreachDraftingService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject("AI_SERVICE") private readonly aiService: AIService,
  ) {}

  async draftOutreach(input: DraftOutreachInput): Promise<DraftOutreachResponse> {
    let lead: LeadRow;
    try {
      lead = await this.getLead(input.leadId);
    } catch {
      return { reason: `Lead ${input.leadId} not found.` };
    }

    const companyId = lead.companyId;

    let evidence: import("@mela/database").CompanyEvidence;
    try {
      evidence = await this.gatherEvidence(companyId);
    } catch {
      return { reason: `Company ${companyId} has no gathered evidence.` };
    }

    const summary = await getCurrentLeadResearchSummary(this.database, input.leadId);
    if (summary === undefined) {
      return { reason: "Lead has no current research summary." };
    }

    const contact = evidence.contacts.find((c) => c.id === input.contactId);
    if (contact === undefined) {
      return { reason: `Contact ${input.contactId} not found.` };
    }

    if (contact.doNotContactAt !== null) {
      return { reason: `Contact ${input.contactId} is marked do-not-contact.` };
    }

    if (evidence.company.doNotContactAt !== null) {
      return { reason: `Company ${companyId} is marked do-not-contact.` };
    }

    const channel = OUTREACH_CHANNELS.find((c) => c.id === input.channelId);
    if (channel === undefined) {
      return { reason: `Unknown channel: ${input.channelId}.` };
    }

    const hasChannelDetail =
      (channel.subjectApplies && contact.email) || contact.phone || contact.linkedinUrl;

    if (!hasChannelDetail) {
      return {
        reason: `Contact ${input.contactId} has no address detail for channel ${input.channelId}.`,
      };
    }

    const facts: OutreachDraftingFacts = {
      company: evidence,
      lead,
      contactId: input.contactId,
      channelId: input.channelId,
      summary: {
        sections: summary.sections as readonly string[],
        citedFacts: summary.citedFacts as readonly string[],
      },
    };

    const modelInput = assembleOutreachDraftingInput(facts);

    const suppliedIdentifiers = [
      ...modelInput.summary.citedFacts.map((f) => f.ref),
      ...modelInput.opportunities.flatMap((o) => [o.ref, ...o.citedEvidence]),
      modelInput.contact.name,
    ];

    const aiResult = await this.aiService.run<OutreachDraftingOutput>(
      "outreach-drafting",
      1,
      modelInput,
    );

    const rawOutput: OutreachDraftingOutput = {
      subject: aiResult.value.subject ?? undefined,
      body: aiResult.value.body,
      claims: aiResult.value.claims,
    };

    const grounding = screenOutreachDraft(rawOutput, suppliedIdentifiers);

    if (grounding.rejections.length > 0) {
      return {
        reason: grounding.rejections.map((r) => `${r.category}: ${r.reason}`).join("; "),
      };
    }

    const channelConstraints = OUTREACH_CHANNELS.find((c) => c.id === input.channelId);
    if (channelConstraints !== undefined) {
      if (
        channelConstraints.subjectApplies &&
        (rawOutput.subject?.length ?? 0) > channelConstraints.maxSubjectLength
      ) {
        return { reason: "Subject exceeds maximum length." };
      }
      if (rawOutput.body.length > channelConstraints.maxBodyLength) {
        return { reason: "Body exceeds maximum length." };
      }
    }

    const draft = await insertOutreachDraft(this.database, {
      leadId: input.leadId,
      channel: input.channelId as OutreachChannelId,
      messageBody: rawOutput.body,
      notes: `AI draft v${1}`,
      isExample: false,
    });

    return {
      outreachId: draft.id,
      promptVersion: 1,
      aiInvocationId: aiResult.invocationId,
      subject: rawOutput.subject ?? "",
      body: rawOutput.body,
      rejections: [],
    };
  }

  private async getLead(leadId: string): Promise<LeadRow> {
    const [lead] = await this.database
      .select()
      .from(require("@mela/database").leads)
      .where(eq(require("@mela/database").leads.id, leadId))
      .limit(1);

    if (lead === undefined) {
      throw new Error(`Lead ${leadId} not found.`);
    }

    return lead as LeadRow;
  }

  private async gatherEvidence(companyId: string) {
    return require("@mela/database").gatherCompanyEvidence(this.database, companyId);
  }

  async listOutreach(filters?: { status?: string; leadId?: string }) {
    const status = filters?.status as OutreachRow["status"] | undefined;
    const rows = await listOutreach(this.database, {
      status,
      leadId: filters?.leadId,
    });
    return rows;
  }

  async updateOutreach(outreachId: string, changes: { subject?: string; messageBody?: string }) {
    return updateOutreachText(this.database, outreachId, changes);
  }

  async submitOutreach(outreachId: string) {
    return submitOutreachForApproval(this.database, outreachId);
  }

  async approveOutreach(outreachId: string) {
    return approveOutreach(this.database, outreachId);
  }

  async rejectOutreach(outreachId: string, reason: string) {
    return rejectOutreach(this.database, outreachId, reason);
  }

  async cancelOutreach(outreachId: string) {
    return cancelOutreach(this.database, outreachId);
  }

  async recordOutreachSent(outreachId: string, body: { sentAt: Date; means: string }) {
    return recordOutreachSend(this.database, {
      outreachId,
      sentAt: body.sentAt,
      means: body.means,
    });
  }

  async classifyResponse(outreachId: string, replyText: string): Promise<ClassifyResponseResult> {
    const [outreach] = await this.database
      .select()
      .from(require("@mela/database").outreach)
      .where(eq(require("@mela/database").outreach.id, outreachId))
      .limit(1);

    if (outreach === undefined) {
      throw new Error(`Outreach ${outreachId} not found.`);
    }

    const channel = OUTREACH_CHANNELS.find((c) => c.id === outreach.channel);
    const categories = DEFAULT_RESPONSE_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.name,
    }));

    const input = outreachResponseClassificationInputSchema.parse({
      replyText,
      outreachChannel: channel?.name ?? outreach.channel,
      categories,
    });

    const aiResult = await this.aiService.run<OutreachResponseClassificationOutput>(
      "outreach-response-classification",
      1,
      input,
    );

    const output = aiResult.value;
    const basisText = output.basisText.trim();
    const isGrounded = basisText.length > 0 && replyText.includes(basisText);

    const category = isGrounded ? output.categoryId : "unclassified";
    const finalBasis = isGrounded
      ? basisText
      : "The proposed basis text was not found in the reply.";

    const proposedTransition = isGrounded
      ? (DEFAULT_RESPONSE_CATEGORIES.find((c) => c.id === category)?.proposedTransition ?? null)
      : null;

    return {
      outreachId,
      categoryId: category,
      basisText: finalBasis,
      isClassified: isGrounded,
      proposedTransition,
    };
  }

  async recordResponse(
    outreachId: string,
    body: {
      categoryId: string;
      receivedAt: Date;
      body?: string;
      proposedCategoryId?: string;
      aiInvocationId?: string;
    },
  ): Promise<{ outreachId: string; responseId: string; leadStatus: string }> {
    const [outreach] = await this.database
      .select()
      .from(require("@mela/database").outreach)
      .where(eq(require("@mela/database").outreach.id, outreachId))
      .limit(1);

    if (outreach === undefined) {
      throw new Error(`Outreach ${outreachId} not found.`);
    }

    const category = DEFAULT_RESPONSE_CATEGORIES.find((c) => c.id === body.categoryId);
    if (category === undefined) {
      throw new Error(`Unknown response category "${body.categoryId}".`);
    }

    const response = await insertOutreachResponse(this.database, {
      outreachId,
      kind: "replied",
      receivedAt: body.receivedAt,
      body: body.body ?? null,
      proposedCategoryId: body.proposedCategoryId ?? null,
      confirmedCategoryId: body.categoryId,
      aiInvocationId: body.aiInvocationId ?? null,
    });

    const lead = await applyLeadStatusChange(
      this.database,
      outreach.leadId,
      category.proposedTransition as any,
    );

    if (body.categoryId === "unsubscribe") {
      const [company] = await this.database
        .select()
        .from(require("@mela/database").companies)
        .where(eq(require("@mela/database").companies.id, lead.companyId))
        .limit(1);

      if (company !== undefined && company.doNotContactAt === null) {
        await setCompanyDoNotContact(this.database, {
          companyId: company.id,
          reason: "Unsubscribe request",
        });
      }
    }

    return {
      outreachId,
      responseId: response.id,
      leadStatus: lead.status,
    };
  }

  async recordNoResponse(
    outreachId: string,
    receivedAt: Date,
  ): Promise<{ outreachId: string; responseId: string }> {
    const [outreach] = await this.database
      .select()
      .from(require("@mela/database").outreach)
      .where(eq(require("@mela/database").outreach.id, outreachId))
      .limit(1);

    if (outreach === undefined) {
      throw new Error(`Outreach ${outreachId} not found.`);
    }

    if (outreach.sentAt === null) {
      throw new Error("Outreach has not been sent.");
    }

    const elapsedDays = (receivedAt.getTime() - outreach.sentAt.getTime()) / (1000 * 60 * 60 * 24);
    if (elapsedDays < NO_RESPONSE_INTERVAL_DAYS) {
      throw new Error(`No-response can only be recorded after ${NO_RESPONSE_INTERVAL_DAYS} days.`);
    }

    const response = await insertOutreachResponse(this.database, {
      outreachId,
      kind: "no_response",
      receivedAt,
      body: null,
      proposedCategoryId: null,
      confirmedCategoryId: "unclassified",
      aiInvocationId: null,
    });

    return {
      outreachId,
      responseId: response.id,
    };
  }

  async setCompanyDoNotContact(companyId: string, reason: string) {
    return setCompanyDoNotContact(this.database, { companyId, reason });
  }

  async clearCompanyDoNotContact(companyId: string) {
    return clearCompanyDoNotContact(this.database, companyId);
  }

  async setContactDoNotContact(contactId: string, reason: string) {
    return setContactDoNotContact(this.database, { contactId, reason });
  }

  async clearContactDoNotContact(contactId: string) {
    return clearContactDoNotContact(this.database, contactId);
  }
}
