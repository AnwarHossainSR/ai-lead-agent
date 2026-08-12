import type { AIService } from "@mela/ai";

/**
 * A person extracted by the model, after grounding and discard checks.
 */
export interface ExtractedPerson {
  readonly name: string;
  readonly role: string | undefined;
  readonly namingText: string;
}

/**
 * Output from the people-extract prompt.
 */
interface PeopleExtractOutput {
  readonly people: readonly {
    readonly name: string;
    readonly role?: string;
    readonly namingText: string;
  }[];
}

/**
 * Result of model-based extraction.
 */
export interface ModelExtractionResult {
  readonly people: readonly ExtractedPerson[];
  readonly groundingFailures: number;
  readonly addressDiscards: number;
}

/**
 * Pattern matching email addresses in text.
 */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/**
 * Checks if a string contains an email address.
 */
function containsEmail(text: string): boolean {
  return EMAIL_PATTERN.test(text);
}

/**
 * Checks if the naming text appears in the page content.
 *
 * The naming text must be a substring of the page text (grounding check).
 * This prevents the model from inventing people not present on the page.
 */
function isNamingTextGrounded(namingText: string, pageText: string): boolean {
  if (namingText.trim().length === 0) {
    return false;
  }

  // Case-insensitive substring check
  const normalizedNaming = namingText.toLowerCase();
  const normalizedPage = pageText.toLowerCase();

  return normalizedPage.includes(normalizedNaming);
}

/**
 * Extracts people from pages using the model.
 *
 * For each page:
 * 1. Calls the AI service with the people-extract prompt
 * 2. Validates grounding (namingText must appear in page)
 * 3. Discards any email addresses appearing in name or role fields
 * 4. Returns the validated people with metadata
 */
export async function extractPeopleWithModel(
  aiService: AIService,
  pages: readonly { readonly url: string; readonly text: string }[],
): Promise<ModelExtractionResult> {
  const allPeople: ExtractedPerson[] = [];
  let groundingFailures = 0;
  let addressDiscards = 0;

  for (const page of pages) {
    try {
      const result = await aiService.run<PeopleExtractOutput>(
        "people-extract",
        1,
        {
          input: page.text,
          pageUrl: page.url,
        },
      );

      for (const person of result.value.people) {
        // Grounding check: namingText must appear in the page
        if (!isNamingTextGrounded(person.namingText, page.text)) {
          groundingFailures++;
          continue;
        }

        // Discard check: name must not contain an email address
        if (containsEmail(person.name)) {
          addressDiscards++;
          continue;
        }

        // Discard check: role must not contain an email address
        if (person.role !== undefined && containsEmail(person.role)) {
          addressDiscards++;
          continue;
        }

        allPeople.push({
          name: person.name,
          role: person.role,
          namingText: person.namingText,
        });
      }
    } catch {
      // Model call failed — skip this page, continue with others
      // The AI service already records the invocation failure
    }
  }

  return {
    people: allPeople,
    groundingFailures,
    addressDiscards,
  };
}
