import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseSearchParams } from "./search-params";

const filtersSchema = z.object({
  priority: z.enum(["low", "medium", "high"]).catch("low").optional(),
  minScore: z.coerce.number().int().min(0).max(100).catch(0).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

describe("parseSearchParams", () => {
  it("parses present values", () => {
    const result = parseSearchParams({ priority: "high", minScore: "80" }, filtersSchema);

    expect(result).toEqual({ priority: "high", minScore: 80, order: "desc" });
  });

  it("applies schema defaults for absent values", () => {
    const result = parseSearchParams({}, filtersSchema);

    expect(result.order).toBe("desc");
    expect(result.priority).toBeUndefined();
  });

  it("keeps only the first value of a multi-value param", () => {
    const result = parseSearchParams({ priority: ["high", "low"] }, filtersSchema);

    expect(result.priority).toBe("high");
  });

  it("falls back rather than throwing on a value the schema rejects", () => {
    const result = parseSearchParams(
      { priority: "urgent", minScore: "not-a-number" },
      filtersSchema,
    );

    expect(result.priority).toBe("low");
    expect(result.minScore).toBe(0);
  });
});
