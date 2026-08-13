import type { CompanyEvidence } from "@mela/database";
import type { LeadRow } from "@mela/database";

export interface UnknownFacts {
  readonly facts: readonly string[];
}

export function deriveUnknownFacts(
  company: CompanyEvidence,
  _lead: LeadRow,
): UnknownFacts {
  const facts: string[] = [];

  if (!company.company.description) {
    facts.push("company_description");
  }

  if (!company.company.companySize) {
    facts.push("company_size");
  }

  if (!company.contacts.some((contact) => contact.email)) {
    facts.push("contact_email");
  }

  if (!company.contacts.some((contact) => contact.phone)) {
    facts.push("contact_phone");
  }

  if (!company.contacts.some((contact) => contact.jobTitle)) {
    facts.push("contact_job_title");
  }

  if (company.analysis === undefined) {
    facts.push("website_analysis");
  } else {
    if (!company.analysis.observations.length) {
      facts.push("website_observations");
    }

    if (!company.analysis.technologyStack.length) {
      facts.push("technology_detections");
    }
  }

  if (!company.opportunities.length) {
    facts.push("opportunities");
  }

  if (company.company.verificationState === "never_checked") {
    facts.push("verification_status");
  }

  return { facts };
}
