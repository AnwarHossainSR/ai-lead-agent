import type { OutreachDraftingInput } from "@mela/ai";
import type { CompanyEvidence } from "@mela/database";
import type { LeadRow } from "@mela/database";
import { OUTREACH_CHANNELS, SERVICES } from "@mela/config";

const MAX_OPPORTUNITIES = 10;

export interface OutreachDraftingFacts {
  readonly company: CompanyEvidence;
  readonly lead: LeadRow;
  readonly contactId: string;
  readonly channelId: string;
  readonly summary: {
    sections: readonly string[];
    citedFacts: readonly string[];
  };
}

export function assembleOutreachDraftingInput(
  facts: OutreachDraftingFacts,
): OutreachDraftingInput {
  const channel = OUTREACH_CHANNELS.find((c) => c.id === facts.channelId);
  if (channel === undefined) {
    throw new Error(`Unknown outreach channel: ${facts.channelId}`);
  }

  const contact = facts.company.contacts.find((c) => c.id === facts.contactId);
  if (contact === undefined) {
    throw new Error(`Contact ${facts.contactId} not found for company ${facts.company.companyId}.`);
  }

  const hasChannelDetail =
    (channel.subjectApplies && contact.email) ||
    contact.phone ||
    contact.linkedinUrl;

  if (!hasChannelDetail) {
    throw new Error(
      `Contact ${facts.contactId} has no address detail for channel ${facts.channelId}.`,
    );
  }

  const citedFacts = facts.summary.citedFacts.map((detail, index) => ({
    ref: `s${index + 1}`,
    detail,
    url: facts.company.company.website ?? "",
  }));

  const opportunities = facts.company.opportunities
    .slice(0, MAX_OPPORTUNITIES)
    .map((opportunity, index) => ({
      ref: `o${index + 1}`,
      title: opportunity.title,
      description: opportunity.description,
      impact: opportunity.impact,
      citedEvidence: Array.isArray(opportunity.citedEvidence)
        ? (opportunity.citedEvidence as string[])
        : [],
    }));

  const contactDetails: OutreachDraftingInput["contact"] = {
    name: contact.name,
    jobTitle: contact.jobTitle ?? undefined,
    email: contact.email ?? undefined,
    phone: contact.phone ?? undefined,
    linkedinUrl: contact.linkedinUrl ?? undefined,
  };

  const services = SERVICES.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
  }));

  return {
    channel: {
      id: channel.id,
      name: channel.name,
      tone: channel.tone,
      subjectApplies: channel.subjectApplies,
      maxSubjectLength: channel.maxSubjectLength,
      maxBodyLength: channel.maxBodyLength,
    },
    summary: {
      sections: facts.summary.sections,
      citedFacts,
    },
    opportunities,
    contact: contactDetails,
    services,
  };
}
