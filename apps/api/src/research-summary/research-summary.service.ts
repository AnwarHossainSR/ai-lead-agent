import { Inject, Injectable } from "@nestjs/common";

import { eq } from "drizzle-orm";

import type { AIService } from "@mela/ai";
import type { CompanyEvidence, Database } from "@mela/database";
import { getCurrentLeadResearchSummary, insertLeadResearchSummary } from "@mela/database";
import { DATABASE } from "../database/database.module";
import { type Rejection, screenResearchSummaryOutput } from "./grounding";
import { type ResearchSummaryFacts, assembleResearchSummaryInput } from "./input";
import { deriveUnknownFacts } from "./unknowns";

export interface GenerateResearchSummaryInput {
  readonly leadId: string;
}

export interface GenerateResearchSummaryResult {
  readonly leadId: string;
  readonly summaryId: string;
  readonly promptVersion: number;
  readonly aiInvocationId: string;
  readonly rejections: Rejection[];
  readonly unknownFacts: readonly string[];
}

@Injectable()
export class ResearchSummaryService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject("AI_SERVICE") private readonly aiService: AIService,
  ) {}

  async generateSummary(
    input: GenerateResearchSummaryInput,
  ): Promise<GenerateResearchSummaryResult> {
    const [lead] = await this.database
      .select()
      .from(require("@mela/database").leads)
      .where(eq(require("@mela/database").leads.id, input.leadId))
      .limit(1);

    if (lead === undefined) {
      throw new Error(`Lead ${input.leadId} not found.`);
    }

    const leadRow = lead as unknown as import("@mela/database").LeadRow;

    const companyId = leadRow.companyId;

    const [company] = await this.database
      .select()
      .from(require("@mela/database").companies)
      .where(eq(require("@mela/database").companies.id, companyId))
      .limit(1);

    if (company === undefined) {
      throw new Error(`Company ${companyId} not found.`);
    }

    const companyEvidence = (await require("@mela/database").gatherCompanyEvidence(
      this.database,
      companyId,
    )) as any;

    const facts: ResearchSummaryFacts = {
      company: companyEvidence as CompanyEvidence,
      lead: leadRow,
    };

    const promptInput = assembleResearchSummaryInput(facts);

    const aiResult = await this.aiService.run<{
      business: { text: string; cites: string[] }[];
      webPresence: { text: string; cites: string[] }[];
      opportunities: { text: string; cites: string[] }[];
      people: { text: string; cites: string[] }[];
      approach: { text: string; cites: string[] }[];
    }>("research-summary", 1, promptInput);

    const screening = screenResearchSummaryOutput(aiResult.value);

    if (
      screening.output.business.length === 0 &&
      screening.output.webPresence.length === 0 &&
      screening.output.opportunities.length === 0 &&
      screening.output.people.length === 0 &&
      screening.output.approach.length === 0
    ) {
      return {
        leadId: input.leadId,
        summaryId: "",
        promptVersion: 1,
        aiInvocationId: aiResult.invocationId,
        rejections: screening.rejections,
        unknownFacts: [],
      };
    }

    const unknownFacts = deriveUnknownFacts(companyEvidence as CompanyEvidence, leadRow);

    const citedFacts = collectCitations(screening.output);

    const summary = await insertLeadResearchSummary(this.database, {
      leadId: input.leadId,
      companyId,
      sections: {
        business: screening.output.business,
        webPresence: screening.output.webPresence,
        opportunities: screening.output.opportunities,
        people: screening.output.people,
        approach: screening.output.approach,
      },
      citedFacts: citedFacts as string[],
      unknownFacts: unknownFacts.facts as string[],
      rejections: screening.rejections,
      promptVersion: 1,
      aiInvocationId: aiResult.invocationId,
    });

    return {
      leadId: input.leadId,
      summaryId: summary.id,
      promptVersion: 1,
      aiInvocationId: aiResult.invocationId,
      rejections: screening.rejections,
      unknownFacts: unknownFacts.facts,
    };
  }

  async getCurrentSummary(leadId: string) {
    return getCurrentLeadResearchSummary(this.database, leadId);
  }
}

function collectCitations(output: {
  business: readonly { text: string; cites: readonly string[] }[];
  webPresence: readonly { text: string; cites: readonly string[] }[];
  opportunities: readonly { text: string; cites: readonly string[] }[];
  people: readonly { text: string; cites: readonly string[] }[];
  approach: readonly { text: string; cites: readonly string[] }[];
}): string[] {
  const citations = new Set<string>();

  for (const section of [
    output.business,
    output.webPresence,
    output.opportunities,
    output.people,
    output.approach,
  ]) {
    for (const claim of section) {
      for (const citation of claim.cites) {
        citations.add(citation);
      }
    }
  }

  return Array.from(citations);
}
