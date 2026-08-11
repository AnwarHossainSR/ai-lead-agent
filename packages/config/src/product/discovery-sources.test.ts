import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../internal/errors";
import {
  ACTIVE_DISCOVERY_SOURCES,
  DISCOVERY_SOURCES,
  discoverySourceSchema,
  findDiscoverySource,
  parseDiscoverySources,
  resolveDiscoverySource,
} from "./discovery-sources";

const source = {
  id: "places",
  name: "Places",
  kind: "places",
  enabled: true,
  coveredCountries: ["uae"],
  maxRequestRatePerMinute: 30,
} as const;

describe("initial discovery sources", () => {
  it("declares file-import, places and one directory", () => {
    expect(DISCOVERY_SOURCES.map((entry) => entry.id).sort()).toEqual([
      "business_directory",
      "file_import",
      "places",
    ]);
  });

  it("keeps file-import enabled as the zero-dependency source", () => {
    expect(findDiscoverySource("file_import")?.enabled).toBe(true);
  });

  it("keeps places disabled until a licensed key is configured", () => {
    expect(findDiscoverySource("places")?.enabled).toBe(false);
  });

  it("defaults crawl permission to denied for every initial source", () => {
    for (const entry of DISCOVERY_SOURCES) {
      expect(entry.crawlAllowed).toBe(false);
    }
  });

  it("exposes only enabled sources as active", () => {
    expect(ACTIVE_DISCOVERY_SOURCES.map((entry) => entry.id)).toEqual(["file_import"]);
  });
});

describe("crawl permission", () => {
  it("treats a source configured without a crawl setting as not crawlable", () => {
    const parsed = discoverySourceSchema.parse(source);
    expect(parsed.crawlAllowed).toBe(false);
  });

  it("honours an explicit crawl permission", () => {
    const parsed = discoverySourceSchema.parse({ ...source, crawlAllowed: true });
    expect(parsed.crawlAllowed).toBe(true);
  });

  it("carries no field that could override robots exclusion or a crawl delay", () => {
    const forbidden = /robots|override|challenge|proxy|evasion|crawl.?delay/i;
    const keys = Object.keys(discoverySourceSchema.shape);

    for (const key of keys) {
      expect(key).not.toMatch(forbidden);
    }
  });
});

describe("resolving a discovery source", () => {
  it("returns the configured entry for a known identifier", () => {
    expect(resolveDiscoverySource("file_import").name).toBe("File Import");
  });

  it("refuses an unknown identifier rather than returning a default", () => {
    const resolve = (): unknown => resolveDiscoverySource("linkedin");

    expect(resolve).toThrow(ConfigurationError);
    expect(resolve).toThrow(/Unknown discovery source "linkedin"/);
  });

  it("lists the configured sources in the refusal", () => {
    expect(() => resolveDiscoverySource("linkedin")).toThrow(/file_import/);
    expect(() => resolveDiscoverySource("linkedin")).toThrow(/places/);
  });

  it("distinguishes lookup from resolution", () => {
    expect(findDiscoverySource("linkedin")).toBeUndefined();
  });
});

describe("invalid declarations", () => {
  it("refuses two sources sharing an identifier, naming the duplicate", () => {
    const load = (): unknown =>
      parseDiscoverySources([
        { ...source, id: "places" },
        { ...source, id: "places", name: "Places Again" },
      ]);

    expect(load).toThrow(/Duplicate identifier: places/);
  });

  it("refuses a source covering an unconfigured country, naming both", () => {
    const load = (): unknown =>
      parseDiscoverySources([{ ...source, coveredCountries: ["qatar"] }]);

    expect(load).toThrow(/Source "places" covers unknown country "qatar"/);
  });

  it("refuses a non-positive request rate, naming the source", () => {
    const load = (): unknown => parseDiscoverySources([{ ...source, maxRequestRatePerMinute: 0 }]);

    expect(load).toThrow(/Source "places" declares a maximum request rate/);
  });

  it("refuses a fractional request rate, naming the source", () => {
    const load = (): unknown =>
      parseDiscoverySources([{ ...source, maxRequestRatePerMinute: 0.5 }]);

    expect(load).toThrow(/Source "places" declares a maximum request rate/);
  });

  it("refuses a source with no covered countries", () => {
    const load = (): unknown =>
      parseDiscoverySources([{ ...source, coveredCountries: [] }]);

    expect(load).toThrow(/Expected at least one covered country/);
  });

  it("refuses a declaration that is not an array", () => {
    const load = (): unknown => parseDiscoverySources(source);

    expect(load).toThrow(ConfigurationError);
  });
});
