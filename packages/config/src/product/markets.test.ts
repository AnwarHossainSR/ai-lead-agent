import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../internal/errors";
import {
  ACTIVE_CITIES,
  ACTIVE_COUNTRIES,
  CITIES,
  COUNTRIES,
  findCity,
  findCountry,
  parseMarkets,
} from "./markets";

describe("initial markets", () => {
  it("targets the United Arab Emirates and Saudi Arabia", () => {
    const enabled = ACTIVE_COUNTRIES.map((country) => country.name).sort();
    expect(enabled).toEqual(["Saudi Arabia", "United Arab Emirates"]);
  });

  it("carries an ISO 3166-1 alpha-2 code for each country", () => {
    expect(findCountry("uae")?.isoAlpha2).toBe("AE");
    expect(findCountry("saudi_arabia")?.isoAlpha2).toBe("SA");
  });

  it("places Dubai and Abu Dhabi under the United Arab Emirates", () => {
    const cities = CITIES.filter((city) => city.countryId === "uae").map((city) => city.name);
    expect(cities.sort()).toEqual(["Abu Dhabi", "Dubai"]);
  });

  it("places Riyadh and Jeddah under Saudi Arabia", () => {
    const cities = CITIES.filter((city) => city.countryId === "saudi_arabia").map(
      (city) => city.name,
    );
    expect(cities.sort()).toEqual(["Jeddah", "Riyadh"]);
  });
});

describe("adding a city", () => {
  it("accepts a new city referencing an existing country", () => {
    const markets = parseMarkets(COUNTRIES, [
      ...CITIES,
      { id: "sharjah", name: "Sharjah", countryId: "uae" },
    ]);

    expect(markets.cities.map((city) => city.id)).toContain("sharjah");
    expect(markets.activeCities.map((city) => city.id)).toContain("sharjah");
  });
});

describe("a city referencing an unknown country", () => {
  it("refuses to load, naming the city and the unknown country", () => {
    const load = (): unknown =>
      parseMarkets(COUNTRIES, [{ id: "doha", name: "Doha", countryId: "qatar" }]);

    expect(load).toThrow(ConfigurationError);
    expect(load).toThrow(/City "doha" references unknown country "qatar"/);
  });
});

describe("a duplicated identifier", () => {
  it("refuses two countries with the same identifier", () => {
    const load = (): unknown =>
      parseMarkets(
        [
          { id: "uae", name: "United Arab Emirates", isoAlpha2: "AE", enabled: true },
          { id: "uae", name: "Emirates", isoAlpha2: "AE", enabled: true },
        ],
        [],
      );

    expect(load).toThrow(/Duplicate identifier: uae/);
  });
});

describe("a disabled country", () => {
  const countries = [
    { id: "uae", name: "United Arab Emirates", isoAlpha2: "AE", enabled: true },
    { id: "saudi_arabia", name: "Saudi Arabia", isoAlpha2: "SA", enabled: false },
  ];
  const cities = [
    { id: "dubai", name: "Dubai", countryId: "uae" },
    { id: "riyadh", name: "Riyadh", countryId: "saudi_arabia" },
  ];

  it("is excluded from active targeting together with its cities", () => {
    const markets = parseMarkets(countries, cities);

    expect(markets.activeCountries.map((country) => country.id)).toEqual(["uae"]);
    expect(markets.activeCities.map((city) => city.id)).toEqual(["dubai"]);
  });

  it("remains resolvable so historical records still render", () => {
    const markets = parseMarkets(countries, cities);

    expect(markets.countries.map((country) => country.id)).toContain("saudi_arabia");
    expect(markets.cities.map((city) => city.id)).toContain("riyadh");
  });
});

describe("resolution", () => {
  it("returns undefined for an unknown identifier rather than a placeholder", () => {
    expect(findCountry("atlantis")).toBeUndefined();
    expect(findCity("atlantis")).toBeUndefined();
  });
});

describe("invalid entries", () => {
  it("refuses a lower-case ISO code, naming the field path", () => {
    const load = (): unknown =>
      parseMarkets(
        [{ id: "uae", name: "United Arab Emirates", isoAlpha2: "ae", enabled: true }],
        [],
      );

    expect(load).toThrow(/0\.isoAlpha2 — Expected an ISO 3166-1 alpha-2 code/);
  });

  it("refuses an empty display name", () => {
    const load = (): unknown =>
      parseMarkets([{ id: "uae", name: "  ", isoAlpha2: "AE", enabled: true }], []);

    expect(load).toThrow(/0\.name — Expected a non-empty display name/);
  });

  it("refuses an identifier that is not lower_snake_case", () => {
    const load = (): unknown =>
      parseMarkets(
        [{ id: "UAE", name: "United Arab Emirates", isoAlpha2: "AE", enabled: true }],
        [],
      );

    expect(load).toThrow(/0\.id — Expected a lower_snake_case identifier/);
  });
});

describe("active collections", () => {
  it("include every city of an enabled country", () => {
    expect(ACTIVE_CITIES).toHaveLength(CITIES.length);
  });
});
