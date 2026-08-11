import { z } from "zod";

import { assertUniqueIdentifiers, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { displayNameSchema, identifierSchema } from "../internal/identifier";

export const industrySchema = z.object({
  id: identifierSchema,
  name: displayNameSchema,
  enabled: z.boolean(),
});

export type Industry = z.infer<typeof industrySchema>;

export function parseIndustries(raw: unknown): readonly Industry[] {
  const industries = parseOrThrow("Industry configuration", z.array(industrySchema), raw);

  assertUniqueIdentifiers(
    "Industry configuration",
    industries.map((industry) => industry.id),
  );

  return deepFreeze(industries);
}

const INDUSTRY_DATA = [
  { id: "real_estate", name: "Real Estate", enabled: true },
  { id: "logistics", name: "Logistics", enabled: true },
  { id: "hospitality", name: "Hospitality", enabled: true },
  { id: "ecommerce", name: "E-Commerce", enabled: true },
  { id: "business_services", name: "Business Services", enabled: true },
] as const;

export const INDUSTRIES = parseIndustries(INDUSTRY_DATA);

export const ACTIVE_INDUSTRIES = deepFreeze(INDUSTRIES.filter((industry) => industry.enabled));

/** A disabled industry stays resolvable so historical records still render. */
export function findIndustry(id: string): Industry | undefined {
  return INDUSTRIES.find((industry) => industry.id === id);
}

export function isIndustryId(id: string): boolean {
  return findIndustry(id) !== undefined;
}

export type IndustryId = (typeof INDUSTRY_DATA)[number]["id"];
