import { describe, expect, it } from "vitest";

describe("ScoringService purity", () => {
  it("does not import or reference any AI/LLM module", () => {
    const source = require("fs").readFileSync(require.resolve("./scoring.service.ts"), "utf-8");
    expect(source).not.toMatch(/@mela\/ai|AIService|GeminiProvider|model\s*call|language\s*model/i);
  });

  it("does not import or reference any AI/LLM controller", () => {
    const source = require("fs").readFileSync(require.resolve("./scoring.controller.ts"), "utf-8");
    expect(source).not.toMatch(/@mela\/ai|AIService|GeminiProvider|model\s*call|language\s*model/i);
  });

  it("does not reference any HTTP client or fetch utility", () => {
    const source = require("fs").readFileSync(require.resolve("./scoring.service.ts"), "utf-8");
    expect(source).not.toMatch(/fetch\(|http[s]?\.request|axios|got\(|superagent|HttpService|HttpClient/i);
  });
});
