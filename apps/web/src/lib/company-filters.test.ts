import { describe, expect, it } from "vitest";

import { buildCompaniesQuery, companyListFiltersSchema } from "./company-filters";

describe("companyListFiltersSchema", () => {
  it("parses known filter values", () => {
    const result = companyListFiltersSchema.parse({
      verificationState: "verified",
      industryId: "logistics",
      cityId: "dubai",
      order: "name_asc",
    });

    expect(result).toEqual({
      verificationState: "verified",
      industryId: "logistics",
      cityId: "dubai",
      order: "name_asc",
    });
  });

  it("defaults order to created_desc and leaves other filters undefined when absent", () => {
    const result = companyListFiltersSchema.parse({});

    expect(result.order).toBe("created_desc");
    expect(result.verificationState).toBeUndefined();
  });

  it("drops an unknown filter value rather than throwing", () => {
    const result = companyListFiltersSchema.parse({
      verificationState: "made-up",
      industryId: "not-a-real-industry",
      order: "sideways",
    });

    expect(result.verificationState).toBeUndefined();
    expect(result.industryId).toBeUndefined();
    expect(result.order).toBe("created_desc");
  });
});

describe("buildCompaniesQuery", () => {
  it("includes only the filters that are set, plus order", () => {
    const query = buildCompaniesQuery({ order: "created_desc", verificationState: "unverified" });

    expect(query).toBe("?verificationState=unverified&order=created_desc");
  });

  it("is just the order param when no filter is set", () => {
    const query = buildCompaniesQuery({ order: "name_asc" });

    expect(query).toBe("?order=name_asc");
  });
});
