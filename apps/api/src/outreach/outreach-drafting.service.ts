import { Inject, Injectable } from "@nestjs/common";

import { eq } from "drizzle-orm";
import type { AIService } from "@mela/ai";
import type { OutreachDraftingOutput } from "@mela/ai";
import type { Database, OutreachRow } from "@mela/database";
import {
  approveOutreach,
  cancelOutreach,
  getCurrentLeadResearchSummary,
  insertOutreachDraft,
  listOutreach,
  rejectOutreach,
  submitOutreachForApproval,
  updateOutreachText,
  type LeadRow,
} from "@mela/database";
import { OUTREACH_CHANNELS, type OutreachChannelId } from "@mela/config";
import { DATABASE } from "../database/database.module";
import { type OutreachDraftingFacts, assembleOutreachDraftingInput } from "./outreach-drafting.input";
import { screenOutreachDraft } from "./outreach-drafting.grounding";

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

    const channel = OUTREACH_CHANNELS.find((c) => c.id === input.channelId);
    if (channel === undefined) {
      return { reason: `Unknown channel: ${input.channelId}.` };
    }

    const hasChannelDetail =
      (channel.subjectApplies && contact.email) ||
      contact.phone ||
      contact.linkedinUrl;

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
}
