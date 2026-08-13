import type { OutreachDraftingOutput } from "@mela/ai";
import { DEFAULT_PROHIBITED_CONTENT_CATEGORIES } from "@mela/config";

export interface Rejection {
  readonly category: string;
  readonly reason: string;
}

export interface GroundingResult {
  readonly output: OutreachDraftingOutput;
  readonly rejections: Rejection[];
}

export function screenOutreachDraft(
  output: OutreachDraftingOutput,
  suppliedIdentifiers: readonly string[],
): GroundingResult {
  const rejections: Rejection[] = [];

  const citationFailures = validateCitations(output.claims, suppliedIdentifiers);
  if (citationFailures.length > 0) {
    rejections.push({
      category: "citation",
      reason: `Uncited or unsupported claim: ${citationFailures[0]}`,
    });
    return { output: { body: "", claims: [] }, rejections };
  }

  const screenedClaims = screenProhibitedContent(output.claims, rejections);
  const bodyRejection = screenProhibitedContentInBody(output.body, rejections);

  if (screenedClaims.length === 0 || bodyRejection) {
    return { output: { body: "", claims: [] }, rejections };
  }

  return {
    output: {
      subject: output.subject,
      body: output.body,
      claims: screenedClaims,
    },
    rejections,
  };
}

function validateCitations(
  claims: OutreachDraftingOutput["claims"],
  suppliedIdentifiers: readonly string[],
): string[] {
  const failures: string[] = [];

  for (const claim of claims) {
    for (const cite of claim.cites) {
      if (!suppliedIdentifiers.includes(cite)) {
        failures.push(`"${claim.text}" cites "${cite}" which was not supplied.`);
      }
    }
  }

  return failures;
}

function screenProhibitedContent(
  claims: OutreachDraftingOutput["claims"],
  rejections: Rejection[],
): OutreachDraftingOutput["claims"] {
  const kept: OutreachDraftingOutput["claims"] = [];

  for (const claim of claims) {
    const matched = matchProhibitedCategories(claim.text);

    if (matched.length > 0) {
      for (const category of matched) {
        rejections.push({
          category,
          reason: `Prohibited content in claim: "${claim.text}"`,
        });
      }
    } else {
      kept.push(claim);
    }
  }

  return kept;
}

function screenProhibitedContentInBody(
  body: string,
  rejections: Rejection[],
): boolean {
  const matched = matchProhibitedCategories(body);

  if (matched.length > 0) {
    for (const category of matched) {
      rejections.push({
        category,
        reason: `Prohibited content in body`,
      });
    }
    return true;
  }

  return false;
}

function matchProhibitedCategories(text: string): string[] {
  const matched: string[] = [];
  const lowerText = text.toLowerCase();

  for (const category of DEFAULT_PROHIBITED_CONTENT_CATEGORIES) {
    for (const pattern of category.patterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        matched.push(category.id);
        break;
      }
    }
  }

  return matched;
}
