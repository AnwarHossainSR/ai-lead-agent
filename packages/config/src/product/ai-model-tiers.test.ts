import { describe, expect, it } from "vitest";

import {
  AI_MODEL_TIERS,
  findAIModelTier,
  parseAIModelTiers,
  resolveAIModelTier,
} from "./ai-model-tiers";

describe("configured tiers", () => {
  it("are default and fast", () => {
    expect(AI_MODEL_TIERS.map((tier) => tier.id)).toEqual(["default", "fast"]);
  });

  it("each declare a model id and positive prices", () => {
    for (const tier of AI_MODEL_TIERS) {
      expect(tier.modelId.length).toBeGreaterThan(0);
      expect(tier.inputPricePerMillionTokensUsd).toBeGreaterThan(0);
      expect(tier.outputPricePerMillionTokensUsd).toBeGreaterThan(0);
    }
  });
});

describe("resolving a tier", () => {
  it("returns the configured entry", () => {
    expect(resolveAIModelTier("default").modelId).toBe("claude-sonnet-5");
  });

  it("refuses an unknown identifier", () => {
    expect(() => resolveAIModelTier("premium")).toThrow(/Unknown AI model tier "premium"/);
  });

  it("find returns undefined rather than throwing", () => {
    expect(findAIModelTier("premium")).toBeUndefined();
  });
});

describe("duplicate identifiers", () => {
  it("are refused at load time", () => {
    const load = (): unknown =>
      parseAIModelTiers([
        {
          id: "default",
          modelId: "a",
          inputPricePerMillionTokensUsd: 1,
          outputPricePerMillionTokensUsd: 1,
        },
        {
          id: "default",
          modelId: "b",
          inputPricePerMillionTokensUsd: 1,
          outputPricePerMillionTokensUsd: 1,
        },
      ]);

    expect(load).toThrow(/Duplicate identifier: default/);
  });
});

describe("non-positive prices", () => {
  it("are refused at load time", () => {
    const load = (): unknown =>
      parseAIModelTiers([
        {
          id: "default",
          modelId: "a",
          inputPricePerMillionTokensUsd: 0,
          outputPricePerMillionTokensUsd: 1,
        },
      ]);

    expect(load).toThrow(/inputPricePerMillionTokensUsd/);
  });
});
