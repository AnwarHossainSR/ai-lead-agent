import type { CompanyEvidence } from "@mela/database";
import type { ResearchSummaryInput } from "@mela/ai";
import type { LeadRow } from "@mela/database";

const MAX_ITEMS_PER_SECTION = 10;

export interface ResearchSummaryFacts {
  readonly company: CompanyEvidence;
  readonly lead: LeadRow;
}

export function assembleResearchSummaryInput(facts: ResearchSummaryFacts): ResearchSummaryInput {
  const { company, lead } = facts;

  return {
    company: {
      name: company.company.name,
      industry: company.company.industryId,
      country: company.company.countryId,
      city: company.company.cityId ?? "",
      website: company.company.website ?? "",
      linkedinUrl: company.company.linkedinUrl ?? undefined,
      companySize: company.company.companySize ?? undefined,
      description: company.company.description ?? undefined,
    },
    observations: company.analysis?.observations
      .slice(0, MAX_ITEMS_PER_SECTION)
      .map((observation, index) => ({
        ref: `o${index + 1}`,
        detail: observation.statement,
        url: observation.evidence.url,
      })) ?? [],
    detections: company.detections
      .slice(0, MAX_ITEMS_PER_SECTION)
      .map((detection, index) => ({
        ref: `t${index + 1}`,
        name: detection.technologyId,
        category: detection.category,
        detail: detection.matchedText ?? `${detection.technologyId} detected`,
        url: `${company.company.website ?? ""}`,
      })) ?? [],
    opportunities: company.opportunities
      .slice(0, MAX_ITEMS_PER_SECTION)
      .map((opportunity, index) => ({
        ref: `opp${index + 1}`,
        title: opportunity.title,
        description: opportunity.description,
        impact: opportunity.impact,
        citedEvidence: Array.isArray(opportunity.citedEvidence)
          ? (opportunity.citedEvidence as string[])
          : [],
      })) ?? [],
    contacts: company.contacts
      .slice(0, MAX_ITEMS_PER_SECTION)
      .map((contact, index) => ({
        ref: `c${index + 1}`,
        name: contact.name,
        jobTitle: contact.jobTitle ?? undefined,
        email: contact.email ?? undefined,
        phone: contact.phone ?? undefined,
        linkedinUrl: contact.linkedinUrl ?? undefined,
      })) ?? [],
    score: {
      total: lead.leadScore,
      priority: lead.priority,
      components: {
        business_fit: lead.businessFitScore,
        technical_opportunity: lead.technicalOpportunityScore,
        business_opportunity: lead.businessOpportunityScore,
        decision_maker_found: lead.decisionMakerFoundScore,
        company_quality: lead.companyQualityScore,
      },
      explanation: lead.scoreExplanation,
    },
  };
}
