import {
  CITIES,
  COUNTRIES,
  INDUSTRIES,
  SERVICES,
  findCity,
  isCityId,
  isCountryId,
  isIndustryId,
  isServiceId,
} from "@mela/config";
import { z } from "zod";

/**
 * Zod schemas for the configuration identifiers stored as `text` (design D4).
 *
 * The database cannot check these — they are deliberately not PostgreSQL enums
 * so that a new city stays a configuration edit rather than a migration — so
 * these schemas are the boundary. A refusal names the unknown identifier and
 * lists what is configured, because "invalid country" without the list is a
 * message that sends someone reading source code.
 */

function configuredIdentifier(kind: string, isKnown: (value: string) => boolean, known: string[]) {
  return z.string().superRefine((value, ctx) => {
    if (!isKnown(value)) {
      ctx.addIssue({
        code: "custom",
        message: `Unknown ${kind} identifier "${value}". Configured ${kind}s: ${known.join(", ")}.`,
      });
    }
  });
}

export const countryIdSchema = configuredIdentifier(
  "country",
  isCountryId,
  COUNTRIES.map((country) => country.id),
);

export const cityIdSchema = configuredIdentifier(
  "city",
  isCityId,
  CITIES.map((city) => city.id),
);

export const industryIdSchema = configuredIdentifier(
  "industry",
  isIndustryId,
  INDUSTRIES.map((industry) => industry.id),
);

export const serviceIdSchema = configuredIdentifier(
  "service",
  isServiceId,
  SERVICES.map((service) => service.id),
);

/**
 * A city belongs to exactly one country, so a record naming Riyadh in the UAE
 * is wrong in a way neither identifier alone reveals. Checked here rather than
 * in the database because the relationship lives in configuration.
 */
export function refineCityBelongsToCountry(
  value: { countryId: string; cityId?: string | null },
  ctx: z.RefinementCtx,
): void {
  const { cityId, countryId } = value;

  if (cityId === undefined || cityId === null) {
    return;
  }

  const city = findCity(cityId);

  // An unknown city is already reported by cityIdSchema; saying it twice adds
  // noise without adding information.
  if (city === undefined) {
    return;
  }

  if (city.countryId !== countryId) {
    ctx.addIssue({
      code: "custom",
      path: ["cityId"],
      message: `City "${cityId}" belongs to country "${city.countryId}", not "${countryId}".`,
    });
  }
}
