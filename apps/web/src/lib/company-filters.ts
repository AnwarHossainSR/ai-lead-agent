import { ACTIVE_CITIES, INDUSTRIES } from "@mela/config";
import { z } from "zod";

/**
 * Mirrors `@mela/database`'s `COMPANY_VERIFICATION_STATES` — duplicated
 * rather than imported, since that package is server-only (a Drizzle/DB
 * client has no place in a Next.js bundle). This is a fixed system enum,
 * not product configuration, so it belongs beside the filter that uses it
 * rather than in `@mela/config`.
 */
const VERIFICATION_STATES = ["never_checked", "verified", "unverified", "unreachable"] as const;

const industryIds = INDUSTRIES.map((industry) => industry.id) as [string, ...string[]];
const cityIds = ACTIVE_CITIES.map((city) => city.id) as [string, ...string[]];

export const companyListFiltersSchema = z.object({
  verificationState: z.enum(VERIFICATION_STATES).optional().catch(undefined),
  industryId: z.enum(industryIds).optional().catch(undefined),
  cityId: z.enum(cityIds).optional().catch(undefined),
  order: z.enum(["created_desc", "name_asc"]).catch("created_desc"),
});

export type CompanyListFilters = z.output<typeof companyListFiltersSchema>;

/** Builds the query string `GET /companies` expects from parsed filters. */
export function buildCompaniesQuery(filters: CompanyListFilters): string {
  const params = new URLSearchParams();

  if (filters.verificationState) params.set("verificationState", filters.verificationState);
  if (filters.industryId) params.set("industryId", filters.industryId);
  if (filters.cityId) params.set("cityId", filters.cityId);
  params.set("order", filters.order);

  return `?${params.toString()}`;
}
