import type { LeadPriority, LeadStatus } from "@mela/config";
import { ACTIVE_CITIES, INDUSTRIES, LEAD_PRIORITIES, LEAD_STATUSES, SERVICES } from "@mela/config";
import { z } from "zod";

const industryIds = INDUSTRIES.map((industry) => industry.id) as [string, ...string[]];
const cityIds = ACTIVE_CITIES.map((city) => city.id) as [string, ...string[]];
const serviceIds = SERVICES.map((service) => service.id) as [string, ...string[]];

/**
 * The lead list's filters (design D6): priority, status, industry, city,
 * service and staleness. Every field falls back to "no filter" rather than
 * throwing, so a hand-edited or stale URL degrades gracefully instead of
 * crashing the page (see `parseSearchParams`).
 */
export const leadListFiltersSchema = z.object({
  priority: z
    .enum(LEAD_PRIORITIES as [LeadPriority, ...LeadPriority[]])
    .optional()
    .catch(undefined),
  status: z
    .enum(LEAD_STATUSES as [LeadStatus, ...LeadStatus[]])
    .optional()
    .catch(undefined),
  industryId: z.enum(industryIds).optional().catch(undefined),
  cityId: z.enum(cityIds).optional().catch(undefined),
  serviceId: z.enum(serviceIds).optional().catch(undefined),
  stale: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
    .catch(undefined),
  order: z.enum(["score_asc", "score_desc"]).catch("score_desc"),
});

export type LeadListFilters = z.output<typeof leadListFiltersSchema>;

/** Builds the query string `GET /leads` expects from parsed filters. */
export function buildLeadsQuery(filters: LeadListFilters): string {
  const params = new URLSearchParams();

  if (filters.priority) params.set("priority", filters.priority);
  if (filters.status) params.set("status", filters.status);
  if (filters.industryId) params.set("industryId", filters.industryId);
  if (filters.cityId) params.set("cityId", filters.cityId);
  if (filters.serviceId) params.set("serviceId", filters.serviceId);
  if (filters.stale !== undefined) params.set("stale", String(filters.stale));
  params.set("order", filters.order);

  return `?${params.toString()}`;
}
