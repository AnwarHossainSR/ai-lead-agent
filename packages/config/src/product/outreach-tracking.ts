import { z } from "zod";

import { ConfigurationError, assertUniqueIdentifiers, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { displayNameSchema, identifierSchema } from "../internal/identifier";
import { LEAD_STATUSES, LIFECYCLE, canTransition } from "./lead-lifecycle";

const SUBJECT = "Outreach response category configuration";

export const responseCategorySchema = z.object({
  id: identifierSchema,
  name: displayNameSchema,
  proposedTransition: z.string().trim().min(1, "Expected a proposed lead status transition."),
});

export type ResponseCategory = z.infer<typeof responseCategorySchema>;

export const responseCategoriesSchema = z.array(responseCategorySchema).min(1);

export type ResponseCategories = z.infer<typeof responseCategoriesSchema>;

export function parseResponseCategories(raw: unknown): readonly ResponseCategory[] {
  const categories = parseOrThrow(SUBJECT, responseCategoriesSchema, raw);

  assertUniqueIdentifiers(
    SUBJECT,
    categories.map((category) => category.id),
  );

  for (const category of categories) {
    if (!LEAD_STATUSES.includes(category.proposedTransition as any)) {
      throw new ConfigurationError(
        SUBJECT,
        `Category "${category.id}" proposes transition to "${category.proposedTransition}", which is not a configured lead status. Configured statuses: ${LEAD_STATUSES.join(", ")}.`,
      );
    }
  }

  const proposedTargets = new Set<string>();
  for (const category of categories) {
    proposedTargets.add(category.proposedTransition);
  }

  for (const category of categories) {
    const sourceStatuses = LEAD_STATUSES.filter((status) =>
      canTransition(status, category.proposedTransition),
    );

    if (sourceStatuses.length === 0) {
      throw new ConfigurationError(
        SUBJECT,
        `Category "${category.id}" proposes transition to "${category.proposedTransition}", but no lead status can transition to it. Configured transitions: ${LEAD_STATUSES.map((s) => `${s} -> [${(LIFECYCLE.transitions[s] ?? []).join(", ")}]`).join("; ")}.`,
      );
    }
  }

  return deepFreeze(categories);
}

const DEFAULT_CATEGORIES = [
  {
    id: "interested",
    name: "Interested",
    proposedTransition: "interested",
  },
  {
    id: "not_interested",
    name: "Not Interested",
    proposedTransition: "not_interested",
  },
  {
    id: "unsubscribe",
    name: "Unsubscribe",
    proposedTransition: "not_interested",
  },
  {
    id: "out_of_office",
    name: "Out of Office",
    proposedTransition: "contacted",
  },
] as const;

export const DEFAULT_RESPONSE_CATEGORIES = parseResponseCategories(DEFAULT_CATEGORIES);

export type ResponseCategoryId = (typeof DEFAULT_CATEGORIES)[number]["id"];

export function findResponseCategory(id: string): ResponseCategory | undefined {
  return DEFAULT_RESPONSE_CATEGORIES.find((category) => category.id === id);
}

export function resolveResponseCategory(id: string): ResponseCategory {
  const category = findResponseCategory(id);

  if (category === undefined) {
    const known = DEFAULT_RESPONSE_CATEGORIES.map((entry) => entry.id).join(", ");
    throw new ConfigurationError(
      SUBJECT,
      `Unknown response category "${id}". Configured categories: ${known}.`,
    );
  }

  return category;
}

export const RESPONSE_CATEGORIES = DEFAULT_RESPONSE_CATEGORIES;

export const NO_RESPONSE_INTERVAL_DAYS = 14;
export const MINIMUM_REPORTING_SAMPLE_SIZE = 10;

const outreachTrackingConfigSchema = z.object({
  noResponseIntervalDays: z.number().int().positive("Expected a positive number of days."),
  minimumReportingSampleSize: z.number().int().positive("Expected a positive sample size."),
});

export type OutreachTrackingConfig = z.infer<typeof outreachTrackingConfigSchema>;

export function parseOutreachTrackingConfig(raw: unknown): OutreachTrackingConfig {
  return parseOrThrow(SUBJECT, outreachTrackingConfigSchema, raw);
}

const DEFAULT_OUTREACH_TRACKING_CONFIG = {
  noResponseIntervalDays: NO_RESPONSE_INTERVAL_DAYS,
  minimumReportingSampleSize: MINIMUM_REPORTING_SAMPLE_SIZE,
} as const;

export const OUTREACH_TRACKING_CONFIG = parseOutreachTrackingConfig(
  DEFAULT_OUTREACH_TRACKING_CONFIG,
);
