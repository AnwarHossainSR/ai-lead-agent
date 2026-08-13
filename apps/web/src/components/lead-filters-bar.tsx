"use client";

import { ACTIVE_CITIES, INDUSTRIES, LEAD_PRIORITIES, LEAD_STATUSES, SERVICES } from "@mela/config";

import { FilterSelect } from "@/components/filter-select";
import { formatLabel } from "@/lib/format-label";
import type { LeadListFilters } from "@/lib/lead-filters";

const STALE_OPTIONS = [
  { value: "true", label: "Stale only" },
  { value: "false", label: "Fresh only" },
];

type LeadFiltersBarProps = Pick<
  LeadListFilters,
  "priority" | "status" | "industryId" | "cityId" | "serviceId" | "stale"
>;

/**
 * Filter controls for the lead list, backed entirely by URL search params
 * (design D6) — there is no client-side filter state to fall out of sync
 * with the URL, so every filtered view is a link.
 */
export function LeadFiltersBar({
  priority,
  status,
  industryId,
  cityId,
  serviceId,
  stale,
}: LeadFiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterSelect
        label="Priority"
        paramKey="priority"
        value={priority}
        options={LEAD_PRIORITIES.map((id) => ({ value: id, label: formatLabel(id) }))}
      />
      <FilterSelect
        label="Status"
        paramKey="status"
        value={status}
        options={LEAD_STATUSES.map((id) => ({ value: id, label: formatLabel(id) }))}
      />
      <FilterSelect
        label="Industry"
        paramKey="industryId"
        value={industryId}
        options={INDUSTRIES.map((industry) => ({ value: industry.id, label: industry.name }))}
      />
      <FilterSelect
        label="City"
        paramKey="cityId"
        value={cityId}
        options={ACTIVE_CITIES.map((city) => ({ value: city.id, label: city.name }))}
      />
      <FilterSelect
        label="Service"
        paramKey="serviceId"
        value={serviceId}
        options={SERVICES.map((service) => ({ value: service.id, label: service.name }))}
      />
      <FilterSelect
        label="Staleness"
        paramKey="stale"
        value={stale === undefined ? undefined : String(stale)}
        options={STALE_OPTIONS}
      />
    </div>
  );
}
