import { z } from "zod";

import { ConfigurationError, assertUniqueIdentifiers, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { displayNameSchema, identifierSchema } from "../internal/identifier";

export const countrySchema = z.object({
  id: identifierSchema,
  name: displayNameSchema,
  isoAlpha2: z
    .string()
    .regex(/^[A-Z]{2}$/, "Expected an ISO 3166-1 alpha-2 code in upper case, e.g. AE."),
  enabled: z.boolean(),
});

export const citySchema = z.object({
  id: identifierSchema,
  name: displayNameSchema,
  countryId: identifierSchema,
});

export type Country = z.infer<typeof countrySchema>;
export type City = z.infer<typeof citySchema>;

export interface Markets {
  /** Every configured country, enabled or not. */
  readonly countries: readonly Country[];
  /** Every configured city, including cities of disabled countries. */
  readonly cities: readonly City[];
  /** Countries currently being targeted. */
  readonly activeCountries: readonly Country[];
  /** Cities whose country is currently being targeted. */
  readonly activeCities: readonly City[];
}

/**
 * Validates a set of countries and cities together, because a city is only
 * meaningful relative to a country that exists.
 */
export function parseMarkets(rawCountries: unknown, rawCities: unknown): Markets {
  const countries = parseOrThrow("Country configuration", z.array(countrySchema), rawCountries);
  const cities = parseOrThrow("City configuration", z.array(citySchema), rawCities);

  assertUniqueIdentifiers(
    "Country configuration",
    countries.map((country) => country.id),
  );
  assertUniqueIdentifiers(
    "City configuration",
    cities.map((city) => city.id),
  );

  const countryIds = new Set(countries.map((country) => country.id));

  for (const city of cities) {
    if (!countryIds.has(city.countryId)) {
      throw new ConfigurationError(
        "City configuration",
        `City "${city.id}" references unknown country "${city.countryId}".`,
      );
    }
  }

  const enabledCountryIds = new Set(
    countries.filter((country) => country.enabled).map((country) => country.id),
  );

  return deepFreeze({
    countries,
    cities,
    activeCountries: countries.filter((country) => country.enabled),
    activeCities: cities.filter((city) => enabledCountryIds.has(city.countryId)),
  });
}

const COUNTRY_DATA = [
  { id: "uae", name: "United Arab Emirates", isoAlpha2: "AE", enabled: true },
  { id: "saudi_arabia", name: "Saudi Arabia", isoAlpha2: "SA", enabled: true },
] as const;

const CITY_DATA = [
  { id: "dubai", name: "Dubai", countryId: "uae" },
  { id: "abu_dhabi", name: "Abu Dhabi", countryId: "uae" },
  { id: "riyadh", name: "Riyadh", countryId: "saudi_arabia" },
  { id: "jeddah", name: "Jeddah", countryId: "saudi_arabia" },
] as const;

export const MARKETS = parseMarkets(COUNTRY_DATA, CITY_DATA);

export const COUNTRIES = MARKETS.countries;
export const CITIES = MARKETS.cities;
export const ACTIVE_COUNTRIES = MARKETS.activeCountries;
export const ACTIVE_CITIES = MARKETS.activeCities;

/**
 * A disabled country stays resolvable so historical records that reference it
 * still render with a name instead of a bare identifier.
 */
export function findCountry(id: string): Country | undefined {
  return COUNTRIES.find((country) => country.id === id);
}

export function findCity(id: string): City | undefined {
  return CITIES.find((city) => city.id === id);
}

export function isCountryId(id: string): boolean {
  return findCountry(id) !== undefined;
}

export function isCityId(id: string): boolean {
  return findCity(id) !== undefined;
}

export type CountryId = (typeof COUNTRY_DATA)[number]["id"];
export type CityId = (typeof CITY_DATA)[number]["id"];
