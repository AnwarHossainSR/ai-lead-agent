import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import * as dedup from "./dedup.service";

/**
 * Task 5.4 — the absence is the control. Deduplication is a deterministic
 * comparison of normalized keys (design D5); no language model is consulted
 * anywhere in the path. If the service ever grows an LLM call — a fuzzy
 * matcher, an embedding lookup, a "confidence score" — this test fails and the
 * design's stated constraint is re-examined.
 */

// Every provider the AI package could hand the service. The service must
// import from none of them and from no other model-backed package.
const LLM_PACKAGES = [
  "@mela/ai",
  "@google/genai",
  "@google/generative-ai",
  "openai",
  "@cloudflare/ai",
];

const SOURCE_PATH = resolve(process.cwd(), "src", "discovery", "dedup.service.ts");

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];

  for (const match of source.matchAll(/import[^;]+from\s+"([^"]+)"/g)) {
    if (match[1] !== undefined) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
}

describe("the dedup service calls no language model", () => {
  it("imports from no package that could invoke a model", () => {
    const source = readFileSync(SOURCE_PATH, "utf8");
    const specifiers = importSpecifiers(source);

    for (const packageName of LLM_PACKAGES) {
      expect(specifiers).not.toContain(packageName);
    }
  });

  it("exports nothing that could invoke a model", () => {
    const exported = Object.keys(dedup);
    expect(exported).toEqual(["DedupService"]);
  });
});
