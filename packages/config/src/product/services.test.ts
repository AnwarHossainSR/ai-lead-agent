import { describe, expect, it } from "vitest";

import { ConfigurationError } from "../internal/errors";
import { SERVICES, findService, parseServices, resolveService } from "./services";

describe("initial services", () => {
  it("includes the five services the company offers", () => {
    expect(SERVICES.map((service) => service.id).sort()).toEqual([
      "aws_and_cloud_modernization",
      "backend_and_api_development",
      "custom_business_platform",
      "web_application_development",
      "website_modernization",
    ]);
  });

  it("describes what each service delivers", () => {
    for (const service of SERVICES) {
      expect(service.description.length).toBeGreaterThan(0);
    }
  });
});

describe("resolving a service", () => {
  it("returns the configured entry for a known identifier", () => {
    expect(resolveService("website_modernization").name).toBe("Website Modernization");
  });

  it("refuses an unknown identifier rather than returning a default", () => {
    const resolve = (): unknown => resolveService("seo_audit");

    expect(resolve).toThrow(ConfigurationError);
    expect(resolve).toThrow(/Unknown service "seo_audit"/);
  });

  it("lists the configured services in the refusal", () => {
    expect(() => resolveService("seo_audit")).toThrow(/website_modernization/);
  });

  it("distinguishes lookup from resolution", () => {
    expect(findService("seo_audit")).toBeUndefined();
  });
});

describe("invalid entries", () => {
  it("refuses a service with no description", () => {
    const load = (): unknown =>
      parseServices([{ id: "seo_audit", name: "SEO Audit", description: "" }]);

    expect(load).toThrow(/0\.description — Expected a description of what the service delivers/);
  });

  it("refuses two services sharing an identifier", () => {
    const load = (): unknown =>
      parseServices([
        { id: "seo_audit", name: "SEO Audit", description: "One." },
        { id: "seo_audit", name: "Search Audit", description: "Two." },
      ]);

    expect(load).toThrow(/Duplicate identifier: seo_audit/);
  });
});
