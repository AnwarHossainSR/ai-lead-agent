import type { ResearchSummaryInput, ResearchSummaryOutput } from "@mela/ai";
import { DEFAULT_PROHIBITED_CLAIM_CATEGORIES } from "@mela/config";

export interface ScreeningResult {
  readonly output: ResearchSummaryOutput;
  readonly rejections: Rejection[];
}

export interface Rejection {
  readonly category: string;
  readonly count: number;
}

export function screenResearchSummaryOutput(
  output: ResearchSummaryOutput,
): ScreeningResult {
  const rejections: Rejection[] = [];

  const screened: ResearchSummaryOutput = {
    business: screenClaims(output.business, rejections),
    webPresence: screenClaims(output.webPresence, rejections),
    opportunities: screenClaims(output.opportunities, rejections),
    people: screenClaims(output.people, rejections),
    approach: screenClaims(output.approach, rejections),
  };

  return { output: screened, rejections };
}

function screenClaims(
  claims: readonly { text: string; cites: readonly string[] }[],
  rejections: Rejection[],
): { text: string; cites: string[] }[] {
  const kept: { text: string; cites: string[] }[] = [];
  const counts = new Map<string, number>();

  for (const claim of claims) {
    const matchedCategories = matchProhibitedCategories(claim.text);

    if (matchedCategories.length > 0) {
      for (const category of matchedCategories) {
        counts.set(category, (counts.get(category) ?? 0) + 1);
      }
    } else {
      kept.push({ text: claim.text, cites: [...claim.cites] });
    }
  }

  for (const [category, count] of counts) {
    rejections.push({ category, count });
  }

  return kept;
}

function matchProhibitedCategories(text: string): string[] {
  const matched: string[] = [];

  for (const category of DEFAULT_PROHIBITED_CLAIM_CATEGORIES) {
    for (const pattern of category.patterns) {
      if (matchesPattern(text, pattern)) {
        matched.push(category.id);
        break;
      }
    }
  }

  return matched;
}

function matchesPattern(text: string, pattern: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerPattern = pattern.toLowerCase();

  return lowerText.includes(lowerPattern);
}

export function assertAllCitationsResolved(
  input: ResearchSummaryInput,
  output: ResearchSummaryOutput,
): void {
  const knownCitations = new Set<string>();

  for (const observation of input.observations) {
    knownCitations.add(observation.ref);
  }

  for (const detection of input.detections) {
    knownCitations.add(detection.ref);
  }

  for (const opportunity of input.opportunities) {
    knownCitations.add(opportunity.ref);
    for (const citation of opportunity.citedEvidence) {
      knownCitations.add(citation);
    }
  }

  for (const contact of input.contacts) {
    knownCitations.add(contact.ref);
  }

  const sections = [
    output.business,
    output.webPresence,
    output.opportunities,
    output.people,
    output.approach,
  ];

  for (const section of sections) {
    for (const claim of section) {
      for (const citation of claim.cites) {
        if (!knownCitations.has(citation)) {
          throw new Error(
            `Citation "${citation}" does not reference any supplied fact.`,
          );
        }
      }
    }
  }
}
