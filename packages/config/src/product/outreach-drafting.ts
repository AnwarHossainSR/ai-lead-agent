import { z } from "zod";

import { ConfigurationError, assertUniqueIdentifiers, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { identifierSchema } from "../internal/identifier";

const SUBJECT = "Outreach drafting prohibited content";

const CATASTROPHIC_BACKTRACKING_PATTERN =
  /(\.\*\+|\.\*\+|\([^)]*[+*][^)]*\)[+*]|[+*][+*]|\(\.\+\)\+)/;
const UNCLOSED_CHARACTER_CLASS_PATTERN = /(^|[^\\])\[[^\]\n]*(?![^[]*])/;

function validatePatterns(patterns: readonly string[]): void {
  for (const pattern of patterns) {
    if (CATASTROPHIC_BACKTRACKING_PATTERN.test(pattern)) {
      throw new ConfigurationError(
        SUBJECT,
        `Pattern "${pattern}" is unsafe: it may cause catastrophic backtracking.`,
      );
    }

    if (UNCLOSED_CHARACTER_CLASS_PATTERN.test(pattern)) {
      throw new ConfigurationError(
        SUBJECT,
        `Pattern "${pattern}" is unsafe: it contains an unclosed character class.`,
      );
    }
  }
}

export const prohibitedContentCategorySchema = z.object({
  id: identifierSchema,
  name: z.string().min(1),
  patterns: z.array(z.string().min(1)).min(1),
});

export type ProhibitedContentCategory = z.infer<typeof prohibitedContentCategorySchema>;

export const prohibitedContentCategoriesSchema = z.array(prohibitedContentCategorySchema).min(1);

export type ProhibitedContentCategories = z.infer<typeof prohibitedContentCategoriesSchema>;

export function parseProhibitedContentCategories(
  raw: unknown,
): readonly ProhibitedContentCategory[] {
  const categories = parseOrThrow(SUBJECT, prohibitedContentCategoriesSchema, raw);

  assertUniqueIdentifiers(
    SUBJECT,
    categories.map((category) => category.id),
  );

  for (const category of categories) {
    validatePatterns(category.patterns);
  }

  return deepFreeze(categories);
}

const DEFAULT_CATEGORIES = [
  {
    id: "invented_fact",
    name: "Invented Fact",
    patterns: [
      "we noticed",
      "we saw",
      "we found",
      "our research shows",
      "we identified",
      "we detected",
      "according to our data",
    ],
  },
  {
    id: "promised_outcome",
    name: "Promised Outcome",
    patterns: [
      "will increase",
      "guaranteed",
      "you'll see",
      "you will see",
      "results in",
      "boost",
      "grow by",
      "improve by",
      "raise",
      "double",
      "triple",
    ],
  },
  {
    id: "false_relationship",
    name: "False Relationship",
    patterns: [
      "as discussed",
      "following our call",
      "as we talked about",
      "you mentioned",
      "you told me",
      "suggested i reach out",
      "asked me to contact you",
      "referred me to you",
    ],
  },
  {
    id: "commercial_terms",
    name: "Commercial Terms",
    patterns: [
      "pricing",
      "rate",
      "costs",
      "cost",
      "price",
      "budget of",
      "$",
      "usd",
      "eur",
      "gbp",
      "days",
      "weeks",
      "months delivery",
      "timeline",
      "deadline",
    ],
  },
  {
    id: "urgency_pressure",
    name: "Urgency Pressure",
    patterns: [
      "limited time",
      "act now",
      "don't miss",
      "expires soon",
      "only a few spots",
      "offer ends",
      "hurry",
      "before it's too late",
      "last chance",
      "exclusive offer",
    ],
  },
] as const;

export const DEFAULT_PROHIBITED_CONTENT_CATEGORIES =
  parseProhibitedContentCategories(DEFAULT_CATEGORIES);

export type ProhibitedContentCategoryId = (typeof DEFAULT_CATEGORIES)[number]["id"];

export function findProhibitedContentCategory(id: string): ProhibitedContentCategory | undefined {
  return DEFAULT_PROHIBITED_CONTENT_CATEGORIES.find((category) => category.id === id);
}

export function resolveProhibitedContentCategory(id: string): ProhibitedContentCategory {
  const category = findProhibitedContentCategory(id);

  if (category === undefined) {
    const known = DEFAULT_PROHIBITED_CONTENT_CATEGORIES.map((entry) => entry.id).join(", ");
    throw new ConfigurationError(
      SUBJECT,
      `Unknown prohibited content category "${id}". Configured categories: ${known}.`,
    );
  }

  return category;
}
