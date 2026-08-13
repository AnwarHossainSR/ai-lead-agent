"use client";

import { ACTIVE_CITIES, INDUSTRIES } from "@mela/config";

import { FilterSelect } from "@/components/filter-select";
import type { CompanyListFilters } from "@/lib/company-filters";
import { formatLabel } from "@/lib/format-label";

const VERIFICATION_STATE_OPTIONS = ["never_checked", "verified", "unverified", "unreachable"].map(
  (id) => ({ value: id, label: formatLabel(id) }),
);

type CompanyFiltersBarProps = Pick<
  CompanyListFilters,
  "verificationState" | "industryId" | "cityId"
>;

/** Filter controls for the company list, backed entirely by URL search params (design D6). */
export function CompanyFiltersBar({
  verificationState,
  industryId,
  cityId,
}: CompanyFiltersBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterSelect
        label="Verification"
        paramKey="verificationState"
        value={verificationState}
        options={VERIFICATION_STATE_OPTIONS}
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
    </div>
  );
}
