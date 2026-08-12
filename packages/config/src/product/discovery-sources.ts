import { z } from "zod";

import { ConfigurationError, assertUniqueIdentifiers, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { displayNameSchema, identifierSchema } from "../internal/identifier";
import { isCountryId } from "./markets";

/**
 * How a source finds companies, which decides what it may lawfully do.
 * `file_import` reads a list a human already has; `places` calls a licensed
 * listings API; `directory` reads a public directory and is the only kind
 * that fetches websites at all.
 */
export const discoverySourceKindSchema = z.enum(["file_import", "places", "directory"]);

export type DiscoverySourceKind = z.infer<typeof discoverySourceKindSchema>;

/**
 * One configured discovery source (design D3).
 *
 * `crawlAllowed` defaults to denied: a source is not contacted through a
 * website fetch until a human explicitly permits it. There is deliberately no
 * field here for ignoring `robots.txt`, bypassing a bot check, or overriding a
 * declared crawl-delay — the configuration carries no anti-bot-evasion setting
 * (the spec asserts this by inspecting the schema).
 */
export const discoverySourceSchema = z.object({
  id: identifierSchema,
  name: displayNameSchema,
  kind: discoverySourceKindSchema,
  enabled: z.boolean(),
  coveredCountries: z.array(identifierSchema).min(1, "Expected at least one covered country."),
  maxRequestRatePerMinute: z.number(),
  crawlAllowed: z.boolean().default(false),
});

export type DiscoverySource = z.infer<typeof discoverySourceSchema>;

/**
 * Validates a discovery source declaration.
 *
 * The structural schema above is deliberately permissive about two fields so
 * that the named checks here can report *which source* is wrong: a rate of
 * zero fails with `Source "places" ...` rather than `1.maxRequestRatePerMinute
 * — Number must be greater than 0`, and coverage of an unknown country names
 * both the source and the country.
 */
export function parseDiscoverySources(raw: unknown): readonly DiscoverySource[] {
  const sources = parseOrThrow(
    "Discovery source configuration",
    z.array(discoverySourceSchema),
    raw,
  );

  assertUniqueIdentifiers(
    "Discovery source configuration",
    sources.map((source) => source.id),
  );

  for (const source of sources) {
    for (const countryId of source.coveredCountries) {
      if (!isCountryId(countryId)) {
        throw new ConfigurationError(
          "Discovery source configuration",
          `Source "${source.id}" covers unknown country "${countryId}".`,
        );
      }
    }

    if (!Number.isInteger(source.maxRequestRatePerMinute) || source.maxRequestRatePerMinute < 1) {
      throw new ConfigurationError(
        "Discovery source configuration",
        `Source "${source.id}" declares a maximum request rate of ${source.maxRequestRatePerMinute}; expected a positive integer per minute.`,
      );
    }
  }

  return deepFreeze(sources);
}

const DISCOVERY_SOURCE_DATA = [
  {
    id: "file_import",
    name: "File Import",
    kind: "file_import",
    enabled: true,
    coveredCountries: ["uae", "saudi_arabia"],
    maxRequestRatePerMinute: 60,
  },
  {
    id: "places",
    name: "Licensed Places API",
    kind: "places",
    // Disabled until a licensed API key is configured (task 7.4): a source
    // that cannot be used should not look usable.
    enabled: false,
    coveredCountries: ["uae", "saudi_arabia"],
    maxRequestRatePerMinute: 30,
  },
  {
    id: "business_directory",
    name: "Business Directory",
    kind: "directory",
    // Declared so the directory kind is configured data, but not enabled and
    // not crawlable: nobody has chosen a directory and permitted it yet.
    enabled: false,
    coveredCountries: ["uae", "saudi_arabia"],
    maxRequestRatePerMinute: 30,
  },
] as const;

export const DISCOVERY_SOURCES = parseDiscoverySources(DISCOVERY_SOURCE_DATA);

export const ACTIVE_DISCOVERY_SOURCES = deepFreeze(
  DISCOVERY_SOURCES.filter((source) => source.enabled),
);

/** A disabled source stays resolvable so historical run records still render. */
export function findDiscoverySource(id: string): DiscoverySource | undefined {
  return DISCOVERY_SOURCES.find((source) => source.id === id);
}

/**
 * Resolves a source identifier, refusing an unknown one and listing what is
 * configured. Returning a default source here would let a run claim a source
 * that was never declared.
 */
export function resolveDiscoverySource(id: string): DiscoverySource {
  const source = findDiscoverySource(id);

  if (source === undefined) {
    const known = DISCOVERY_SOURCES.map((entry) => entry.id).join(", ");
    throw new ConfigurationError(
      "Discovery source configuration",
      `Unknown discovery source "${id}". Configured sources: ${known}.`,
    );
  }

  return source;
}

export function isDiscoverySourceId(id: string): boolean {
  return findDiscoverySource(id) !== undefined;
}

export type DiscoverySourceId = (typeof DISCOVERY_SOURCE_DATA)[number]["id"];
