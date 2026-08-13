import { DEFAULT_BUSINESS_FIT_PROFILE, getComponentRules } from "@mela/config/product/lead-scoring";
import type { CompanyEvidence } from "@mela/database";
import type { ComponentResult, Scorer } from "../scorer";

function matchIndustry(industryId: string | null | undefined): boolean {
  if (industryId === undefined || industryId === null) return false;
  return DEFAULT_BUSINESS_FIT_PROFILE.targetIndustryIds.includes(industryId);
}

function matchCountry(countryId: string | null | undefined): boolean {
  if (countryId === undefined || countryId === null) return false;
  return DEFAULT_BUSINESS_FIT_PROFILE.targetCountryIds.includes(countryId);
}

function matchCity(cityId: string | null | undefined): boolean {
  if (cityId === undefined || cityId === null) return false;
  return DEFAULT_BUSINESS_FIT_PROFILE.targetCityIds.includes(cityId);
}

function matchSize(companySize: string | null | undefined): boolean {
  if (companySize === undefined || companySize === null) return false;
  return DEFAULT_BUSINESS_FIT_PROFILE.preferredCompanySizes.includes(companySize);
}

export const businessFitScorer: Scorer = {
  id: "company_quality",
  score: (evidence: CompanyEvidence): ComponentResult => {
    const rules = getComponentRules("company_quality");
    const company = evidence.company;

    const missing: string[] = [];
    if (company.countryId === undefined || company.countryId === null) missing.push("country");
    if (company.industryId === undefined || company.industryId === null) missing.push("industry");
    if (company.cityId === undefined || company.cityId === null) missing.push("city");
    if (company.companySize === undefined || company.companySize === null)
      missing.push("company_size");

    if (missing.length === 4) {
      return {
        value: 0,
        reasons: [],
        missing: [...missing, "company_profile"],
      };
    }

    const factors = [
      matchIndustry(company.industryId),
      matchCountry(company.countryId),
      matchCity(company.cityId),
      matchSize(company.companySize),
    ];

    const matchCount = factors.filter(Boolean).length;
    const matchPercentage = (matchCount / factors.length) * 100;
    const threshold = rules.thresholds.find(
      (t) => matchPercentage >= t.minimum && matchPercentage <= t.maximum,
    );

    const reasons = [
      `industry ${company.industryId}: ${matchIndustry(company.industryId) ? "target" : "non-target"}`,
      `country ${company.countryId}: ${matchCountry(company.countryId) ? "target" : "non-target"}`,
      `city ${company.cityId ?? "unknown"}: ${matchCity(company.cityId) ? "target" : "non-target"}`,
      `size ${company.companySize ?? "unknown"}: ${matchSize(company.companySize) ? "target" : "non-target"}`,
    ];

    return {
      value: threshold?.points ?? 0,
      reasons,
      missing,
    };
  },
};
