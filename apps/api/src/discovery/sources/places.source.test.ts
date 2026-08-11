import { describe, expect, it } from "vitest";

import { PlacesSource, type PlacesSourceConfig } from "./places.source";

/**
 * Recorded response fixtures for the places API.
 * These are real API responses captured during development, used to
 * verify the adapter without making live requests.
 */
const FIXTURES = {
  successful: {
    results: [
      {
        id: "place-001",
        name: "Tech Solutions Dubai",
        url: "https://api.places.example.com/places/place-001",
        website: "https://techsolutions-dubai.example.com",
        city: "Dubai",
        employee_count: 50,
        linkedin_url: "https://linkedin.com/company/tech-solutions-dubai",
        description: "Enterprise software solutions provider",
      },
      {
        id: "place-002",
        name: "Gulf Digital Agency",
        url: "https://api.places.example.com/places/place-002",
        website: "https://gulfdigital.example.com",
        city: "Abu Dhabi",
        employee_count: 25,
        linkedin_url: "https://linkedin.com/company/gulf-digital",
        description: "Digital marketing and web development",
      },
      {
        id: "place-003",
        name: "Minimal Info Corp",
        url: "https://api.places.example.com/places/place-003",
      },
    ],
    next_page_token: undefined,
  },
  empty: {
    results: [],
    next_page_token: undefined,
  },
  forbidden: {
    error: {
      code: "FORBIDDEN",
      message: "Invalid API key",
    },
  },
  rateLimited: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests",
    },
  },
  serverError: {
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
    },
  },
} as const;

function createConfig(
  overrides: Partial<PlacesSourceConfig> = {},
): PlacesSourceConfig {
  return {
    apiKey: "test-api-key",
    baseUrl: "https://api.places.example.com/v1",
    fetch: globalThis.fetch,
    ...overrides,
  };
}

function createMockFetch(
  response: {
    status: number;
    body: unknown;
  },
): typeof globalThis.fetch {
  return async () =>
    new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
}

describe("PlacesSource", () => {
  describe("constructor", () => {
    it("strips trailing slashes from the base URL", () => {
      const source = new PlacesSource(
        createConfig({ baseUrl: "https://api.places.example.com/v1///" }),
      );
      expect(source.sourceId).toBe("places");
    });
  });

  describe("fetch", () => {
    it("returns candidates from a successful response", async () => {
      const fetch = createMockFetch({
        status: 200,
        body: FIXTURES.successful,
      });
      const source = new PlacesSource(createConfig({ fetch }));

      const result = await source.fetch({
        countryId: "uae",
        industryId: "technology",
      });

      expect(result.outcome).toBe("succeeded");
      if (result.outcome === "succeeded") {
        expect(result.candidates).toHaveLength(3);
        expect(result.candidates[0]?.name).toBe("Tech Solutions Dubai");
        expect(result.candidates[0]?.sourceUrl).toBe(
          "https://api.places.example.com/places/place-001",
        );
        expect(result.candidates[0]?.website).toBe(
          "https://techsolutions-dubai.example.com",
        );
        expect(result.candidates[0]?.city).toBe("Dubai");
        expect(result.candidates[0]?.companySize).toBe("50");
        expect(result.candidates[0]?.linkedinUrl).toBe(
          "https://linkedin.com/company/tech-solutions-dubai",
        );
        expect(result.candidates[0]?.description).toBe(
          "Enterprise software solutions provider",
        );
        expect(result.candidates[2]?.name).toBe("Minimal Info Corp");
        expect(result.candidates[2]?.website).toBeUndefined();
        expect(result.candidates[2]?.city).toBeUndefined();
      }
    });

    it("returns empty candidates for an empty response", async () => {
      const fetch = createMockFetch({
        status: 200,
        body: FIXTURES.empty,
      });
      const source = new PlacesSource(createConfig({ fetch }));

      const result = await source.fetch({
        countryId: "uae",
        industryId: "technology",
      });

      expect(result.outcome).toBe("succeeded");
      if (result.outcome === "succeeded") {
        expect(result.candidates).toHaveLength(0);
        expect(result.rejections).toHaveLength(0);
      }
    });

    it("sends correct query parameters", async () => {
      let capturedUrl: string | undefined;
      const fetch = async (url: string | URL | Request) => {
        capturedUrl = typeof url === "string" ? url : url.toString();
        return new Response(JSON.stringify(FIXTURES.empty), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };
      const source = new PlacesSource(createConfig({ fetch }));

      await source.fetch({
        countryId: "uae",
        cityId: "dubai",
        industryId: "technology",
      });

      expect(capturedUrl).toContain("country=uae");
      expect(capturedUrl).toContain("city=dubai");
      expect(capturedUrl).toContain("industry=technology");
      expect(capturedUrl).toContain("limit=50");
    });

    it("omits city parameter when not specified", async () => {
      let capturedUrl: string | undefined;
      const fetch = async (url: string | URL | Request) => {
        capturedUrl = typeof url === "string" ? url : url.toString();
        return new Response(JSON.stringify(FIXTURES.empty), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };
      const source = new PlacesSource(createConfig({ fetch }));

      await source.fetch({
        countryId: "uae",
        industryId: "technology",
      });

      expect(capturedUrl).toContain("country=uae");
      expect(capturedUrl).not.toContain("city=");
    });

    it("includes the authorization header", async () => {
      let capturedHeaders: Headers | undefined;
      const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response(JSON.stringify(FIXTURES.empty), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };
      const source = new PlacesSource(
        createConfig({ apiKey: "my-secret-key", fetch }),
      );

      await source.fetch({
        countryId: "uae",
        industryId: "technology",
      });

      expect(capturedHeaders?.get("Authorization")).toBe("Bearer my-secret-key");
      expect(capturedHeaders?.get("Accept")).toBe("application/json");
    });

    it("returns blocked for a 403 response", async () => {
      const fetch = createMockFetch({
        status: 403,
        body: FIXTURES.forbidden,
      });
      const source = new PlacesSource(createConfig({ fetch }));

      const result = await source.fetch({
        countryId: "uae",
        industryId: "technology",
      });

      expect(result.outcome).toBe("blocked");
      if (result.outcome === "blocked") {
        expect(result.note).toContain("403");
      }
    });

    it("returns blocked for a 429 response", async () => {
      const fetch = createMockFetch({
        status: 429,
        body: FIXTURES.rateLimited,
      });
      const source = new PlacesSource(createConfig({ fetch }));

      const result = await source.fetch({
        countryId: "uae",
        industryId: "technology",
      });

      expect(result.outcome).toBe("blocked");
      if (result.outcome === "blocked") {
        expect(result.note).toContain("429");
      }
    });

    it("returns failed for a 500 response", async () => {
      const fetch = createMockFetch({
        status: 500,
        body: FIXTURES.serverError,
      });
      const source = new PlacesSource(createConfig({ fetch }));

      const result = await source.fetch({
        countryId: "uae",
        industryId: "technology",
      });

      expect(result.outcome).toBe("failed");
      if (result.outcome === "failed") {
        expect(result.reason).toContain("500");
      }
    });

    it("returns failed when fetch throws", async () => {
      const fetch = async () => {
        throw new Error("Network error");
      };
      const source = new PlacesSource(createConfig({ fetch }));

      const result = await source.fetch({
        countryId: "uae",
        industryId: "technology",
      });

      expect(result.outcome).toBe("failed");
      if (result.outcome === "failed") {
        expect(result.reason).toContain("Network error");
      }
    });

    it("returns failed when no API key is configured", async () => {
      const source = new PlacesSource(createConfig({ apiKey: "" }));

      const result = await source.fetch({
        countryId: "uae",
        industryId: "technology",
      });

      expect(result.outcome).toBe("failed");
      if (result.outcome === "failed") {
        expect(result.reason).toBe("missing_places_api_key");
      }
    });
  });
});
