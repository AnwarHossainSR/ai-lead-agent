import type { AIService } from "@mela/ai";
import { type Database, insertContact, insertContactResearchRun } from "@mela/database";
import { Inject, Injectable, Optional } from "@nestjs/common";

import { DATABASE } from "../database/database.module";
import {
  type ExtractedDetail,
  type StructuredDataPerson,
  extractMailtoLinks,
  extractStructuredData,
  extractTelLinks,
} from "./extraction";
import { extractPeopleWithModel } from "./model-extraction";
import { checkDeliverability, classifySeniority } from "./seniority-deliverability";

/**
 * A person extracted from page content.
 */
export interface ExtractedPerson {
  readonly name: string;
  readonly jobTitle: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly sourceUrl: string;
  readonly extractionMethod: "deterministic" | "model_interpretation";
  readonly aiInvocationId: string | null;
}

/**
 * Research result for a company.
 */
export interface ResearchResult {
  readonly companyId: string;
  readonly contactsFound: number;
  readonly contactsRejected: number;
  readonly rejectionReasons: readonly string[];
  readonly fetchedPages: readonly string[];
  readonly skippedPages: readonly { url: string; reason: string }[];
}

/**
 * Service for researching contacts at companies.
 *
 * Gathers pages, runs extractors, merges results, and persists the findings.
 */
@Injectable()
export class ResearchService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Optional() @Inject("AI_SERVICE") private readonly aiService: AIService | null,
  ) {}

  /**
   * Runs contact research for a company.
   */
  async researchContacts(
    companyId: string,
    pages: readonly { url: string; html: string; text?: string }[],
  ): Promise<ResearchResult> {
    const fetchedPages: string[] = [];
    const skippedPages: { url: string; reason: string }[] = [];
    const allExtracted: ExtractedPerson[] = [];
    const rejectionReasons: string[] = [];

    // Process each page
    for (const page of pages) {
      fetchedPages.push(page.url);

      // Run deterministic extractors
      const mailtoLinks = extractMailtoLinks(page.html, page.url);
      const telLinks = extractTelLinks(page.html, page.url);
      const structuredData = extractStructuredData(page.html, page.url);

      // Merge deterministic results
      const deterministicPeople = this.mergeDeterministicResults(
        mailtoLinks,
        telLinks,
        structuredData,
        page.url,
      );

      allExtracted.push(...deterministicPeople);
    }

    // Run model-based extraction if AI service is available and pages have text
    if (this.aiService !== null) {
      const pagesWithText = pages
        .filter((p) => p.text !== undefined && p.text.length > 0)
        .map((p) => ({ url: p.url, text: p.text! }));

      if (pagesWithText.length > 0) {
        const modelResult = await extractPeopleWithModel(this.aiService, pagesWithText);

        // Convert model results to ExtractedPerson format
        for (const person of modelResult.people) {
          allExtracted.push({
            name: person.name,
            jobTitle: person.role ?? null,
            email: null, // Model never provides email
            phone: null, // Model never provides phone
            sourceUrl: pagesWithText[0]?.url ?? "",
            extractionMethod: "model_interpretation",
            aiInvocationId: null, // Will be set by AI service
          });
        }

        // Track rejection reasons
        if (modelResult.groundingFailures > 0) {
          rejectionReasons.push(`${modelResult.groundingFailures} people failed grounding check`);
        }
        if (modelResult.addressDiscards > 0) {
          rejectionReasons.push(
            `${modelResult.addressDiscards} email addresses discarded from name/role fields`,
          );
        }
      }
    }

    // Deduplicate by name+email
    const uniquePeople = this.deduplicatePeople(allExtracted);

    // Classify seniority and check deliverability
    const enrichedContacts = await this.enrichContacts(uniquePeople);

    // Persist contacts
    let contactsFound = 0;
    let contactsRejected = 0;

    for (const contact of enrichedContacts) {
      try {
        await insertContact(this.database, {
          companyId,
          name: contact.name,
          jobTitle: contact.jobTitle,
          email: contact.email,
          phone: contact.phone,
          certainty: contact.extractionMethod === "deterministic" ? "observed" : "inferred",
          extractionMethod: contact.extractionMethod,
          seniorityId: contact.seniorityId,
          aiInvocationId: contact.aiInvocationId,
          mailDeliverability: contact.mailDeliverability,
          researchSource: "contact_research",
          sourceUrl: contact.sourceUrl,
        });
        contactsFound++;
      } catch (error) {
        contactsRejected++;
        rejectionReasons.push(error instanceof Error ? error.message : "Unknown error");
      }
    }

    // Record the research run
    await insertContactResearchRun(this.database, {
      companyId,
      fetchedPages,
      skippedPages,
      outcome: contactsFound > 0 ? "contacts_found" : "none_found",
      foundCount: contactsFound,
      rejectedCount: contactsRejected,
      rejectionReasons,
    });

    return {
      companyId,
      contactsFound,
      contactsRejected,
      rejectionReasons,
      fetchedPages,
      skippedPages,
    };
  }

  /**
   * Merges results from deterministic extractors.
   */
  private mergeDeterministicResults(
    mailtoLinks: readonly ExtractedDetail[],
    telLinks: readonly ExtractedDetail[],
    structuredData: readonly StructuredDataPerson[],
    pageUrl: string,
  ): ExtractedPerson[] {
    const people: ExtractedPerson[] = [];

    // Add people from structured data
    for (const person of structuredData) {
      people.push({
        name: person.name,
        jobTitle: person.jobTitle ?? null,
        email: person.email ?? null,
        phone: person.phone ?? null,
        sourceUrl: pageUrl,
        extractionMethod: "deterministic",
        aiInvocationId: null,
      });
    }

    // Add emails from mailto links
    for (const email of mailtoLinks) {
      const existing = people.find((p) => p.email === email.value);
      if (existing === undefined) {
        people.push({
          name: this.extractNameFromEmail(email.value),
          jobTitle: null,
          email: email.value,
          phone: null,
          sourceUrl: email.sourceUrl,
          extractionMethod: "deterministic",
          aiInvocationId: null,
        });
      }
    }

    // Add phones from tel links
    for (const phone of telLinks) {
      const existing = people.find((p) => p.phone === phone.value);
      if (existing === undefined) {
        people.push({
          name: "Unknown",
          jobTitle: null,
          email: null,
          phone: phone.value,
          sourceUrl: phone.sourceUrl,
          extractionMethod: "deterministic",
          aiInvocationId: null,
        });
      }
    }

    return people;
  }

  /**
   * Extracts a name from an email address.
   */
  private extractNameFromEmail(email: string): string {
    const localPart = email.split("@")[0] ?? "";
    return localPart
      .replace(/[._-]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Deduplicates people by name and email.
   */
  private deduplicatePeople(people: ExtractedPerson[]): ExtractedPerson[] {
    const seen = new Map<string, ExtractedPerson>();

    for (const person of people) {
      const key = `${person.name.toLowerCase()}|${person.email ?? ""}`;
      if (!seen.has(key)) {
        seen.set(key, person);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Enriches contacts with seniority and deliverability.
   */
  private async enrichContacts(contacts: ExtractedPerson[]): Promise<
    Array<
      ExtractedPerson & {
        seniorityId: string;
        mailDeliverability: "receivable" | "not_receivable" | "unknown";
      }
    >
  > {
    const enriched = [];

    for (const contact of contacts) {
      const seniority = classifySeniority(contact.jobTitle);

      let mailDeliverability: "receivable" | "not_receivable" | "unknown" = "unknown";
      if (contact.email) {
        const domain = contact.email.split("@")[1] ?? "";
        const deliverability = await checkDeliverability(domain);
        mailDeliverability = deliverability.status;
      }

      enriched.push({
        ...contact,
        seniorityId: seniority.levelId,
        mailDeliverability,
      });
    }

    return enriched;
  }
}
