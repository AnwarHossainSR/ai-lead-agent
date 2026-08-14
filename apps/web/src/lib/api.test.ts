import { afterEach, describe, expect, it, vi } from "vitest";

import { apiUrl } from "./api";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("apiUrl", () => {
  it("prefixes the path with /api and joins it to API_URL", () => {
    vi.stubEnv("API_URL", "http://localhost:4000");

    expect(apiUrl("/companies/count")).toBe("http://localhost:4000/api/companies/count");
  });

  it("adds the leading slash if the caller omitted it", () => {
    vi.stubEnv("API_URL", "http://localhost:4000");

    expect(apiUrl("companies/count")).toBe("http://localhost:4000/api/companies/count");
  });

  it("returns null when API_URL is not configured", () => {
    vi.stubEnv("API_URL", "");

    expect(apiUrl("/companies/count")).toBeNull();
  });
});
