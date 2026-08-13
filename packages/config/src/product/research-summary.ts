import { z } from "zod";

import { ConfigurationError } from "../internal/errors";
import { assertUniqueIdentifiers, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { identifierSchema } from "../internal/identifier";

const SUBJECT = "Research summary prohibited claims";

const CATASTROPHIC_BACKTRACKING_PATTERN = /(\.\*\+|\.\*\+|\([^)]*[+*][^)]*\)[+*]|[+*][+*]|\(\.\+\)\+)/;
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

export const prohibitedClaimCategorySchema = z.object({
  id: identifierSchema,
  name: z.string().min(1),
  patterns: z.array(z.string().min(1)).min(1),
});

export type ProhibitedClaimCategory = z.infer<typeof prohibitedClaimCategorySchema>;

export const prohibitedClaimCategoriesSchema = z.array(prohibitedClaimCategorySchema).min(1);

export type ProhibitedClaimCategories = z.infer<typeof prohibitedClaimCategoriesSchema>;

export function parseProhibitedClaimCategories(raw: unknown): readonly ProhibitedClaimCategory[] {
  const categories = parseOrThrow(SUBJECT, prohibitedClaimCategoriesSchema, raw);

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
    id: "finance",
    name: "Finance",
    patterns: ["revenue", "turnover", "profit", "valuation", "funding", "raised", "arr", "budget"],
  },
  {
    id: "size",
    name: "Size",
    patterns: ["employees", "headcount", "staff of", "team of"],
  },
  {
    id: "hiring",
    name: "Hiring",
    patterns: ["hiring", "recruiting", "expanding the team", "open roles"],
  },
  {
    id: "trajectory",
    name: "Trajectory",
    patterns: ["growing rapidly", "scaling", "expanding into", "market leader"],
  },
  {
    id: "plans",
    name: "Plans",
    patterns: ["plans to", "intends to", "is about to", "roadmap"],
  },
  {
    id: "customers",
    name: "Customers",
    patterns: ["serves", "customer base of", "client base of"],
  },
] as const;

export const DEFAULT_PROHIBITED_CLAIM_CATEGORIES = parseProhibitedClaimCategories(
  DEFAULT_CATEGORIES,
);

export type ProhibitedClaimCategoryId = (typeof DEFAULT_CATEGORIES)[number]["id"];

export function findProhibitedClaimCategory(
  id: string,
): ProhibitedClaimCategory | undefined {
  return DEFAULT_PROHIBITED_CLAIM_CATEGORIES.find((category) => category.id === id);
}

export function resolveProhibitedClaimCategory(id: string): ProhibitedClaimCategory {
  const category = findProhibitedClaimCategory(id);

  if (category === undefined) {
    const known = DEFAULT_PROHIBITED_CLAIM_CATEGORIES.map((entry) => entry.id).join(", ");
    throw new ConfigurationError(
      SUBJECT,
      `Unknown prohibited claim category "${id}". Configured categories: ${known}.`,
    );
  }

  return category;
}
