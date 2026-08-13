import { describe, expect, it } from "vitest";

import { buildLeadsQuery, leadListFiltersSchema } from "./lead-filters";

describe("leadListFiltersSchema", () => {
  it("parses known filter values", () => {
    const result = leadListFiltersSchema.parse({
      priority: "high",
      status: "qualified",
      industryId: "logistics",
      cityId: "dubai",
      serviceId: "website_modernization",
      stale: "true",
      order: "score_asc",
    });

    expect(result).toEqual({
      priority: "high",
      status: "qualified",
      industryId: "logistics",
      cityId: "dubai",
      serviceId: "website_modernization",
      stale: true,
      order: "score_asc",
    });
  });

  it("defaults order to score_desc and leaves other filters undefined when absent", () => {
    const result = leadListFiltersSchema.parse({});

    expect(result.order).toBe("score_desc");
    expect(result.priority).toBeUndefined();
    expect(result.stale).toBeUndefined();
  });

  it("drops an unknown filter value rather than throwing", () => {
    const result = leadListFiltersSchema.parse({
      priority: "urgent",
      industryId: "not-a-real-industry",
      order: "sideways",
    });

    expect(result.priority).toBeUndefined();
    expect(result.industryId).toBeUndefined();
    expect(result.order).toBe("score_desc");
  });
});

describe("buildLeadsQuery", () => {
  it("includes only the filters that are set, plus order", () => {
    const query = buildLeadsQuery({ order: "score_desc", priority: "high" });

    expect(query).toBe("?priority=high&order=score_desc");
  });

  it("serialises stale as a string", () => {
    const query = buildLeadsQuery({ order: "score_desc", stale: false });

    expect(query).toBe("?stale=false&order=score_desc");
  });

  it("is just the order param when no filter is set", () => {
    const query = buildLeadsQuery({ order: "score_asc" });

    expect(query).toBe("?order=score_asc");
  });
});
