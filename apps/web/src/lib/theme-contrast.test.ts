import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  type Oklch,
  type ThemeName,
  type TokenName,
  chartRamp,
  decorativePairs,
  nonTextPairs,
  textPairs,
  themeTokens,
} from "./theme-tokens";

/** OKLCH -> linear sRGB, via OKLab (Björn Ottosson's matrices). */
function toLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const lms = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ].map((v) => v ** 3);

  const [long, medium, short] = lms as [number, number, number];
  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ].map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
}

/** WCAG relative luminance, which is defined on linear-light components. */
function relativeLuminance(colour: Oklch): number {
  const [r, g, b] = toLinearRgb(colour);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: Oklch, b: Oklch): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

const themes: ThemeName[] = ["light", "dark"];

describe.each(themes)("%s theme contrast", (theme) => {
  const tokens = themeTokens[theme];

  it.each(textPairs)(
    "renders $foreground on $background at WCAG AA for text",
    ({ foreground, background }) => {
      const ratio = contrastRatio(tokens[foreground], tokens[background]);
      expect(
        ratio,
        `${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(nonTextPairs)(
    "renders $foreground on $background at WCAG AA for non-text",
    ({ foreground, background }) => {
      const ratio = contrastRatio(tokens[foreground], tokens[background]);
      expect(
        ratio,
        `${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(decorativePairs)(
    "keeps $foreground visible against $background",
    ({ foreground, background }) => {
      const ratio = contrastRatio(tokens[foreground], tokens[background]);
      expect(
        ratio,
        `${theme}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(1.3);
    },
  );

  it("keeps adjacent chart series distinguishable in monochrome", () => {
    for (let index = 1; index < chartRamp.length; index += 1) {
      const previous = tokens[chartRamp[index - 1] as TokenName];
      const current = tokens[chartRamp[index] as TokenName];
      expect(
        Math.round(Math.abs(previous.l - current.l) * 1000) / 1000,
        `${theme}: ${chartRamp[index - 1]} and ${chartRamp[index]} share a lightness`,
      ).toBeGreaterThanOrEqual(0.08);
    }
  });

  it("gives every chart series a distinct hue", () => {
    const hues = chartRamp.map((token) => tokens[token as TokenName].h);
    expect(new Set(hues).size).toBe(chartRamp.length);
  });

  it("has no achromatic token left over from the pre-redesign palette", () => {
    const achromatic = Object.entries(tokens).filter(([, value]) => value.c === 0);
    expect(achromatic).toEqual([]);
  });
});

describe("globals.css", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

  function declaredIn(block: string): Map<string, string> {
    const start = css.indexOf(block);
    expect(start, `${block} is missing from globals.css`).toBeGreaterThan(-1);
    const body = css.slice(start + block.length, css.indexOf("}", start));
    const declared = new Map<string, string>();
    for (const line of body.split("\n")) {
      const match = line.match(/^\s*--([\w-]+):\s*(.+);\s*$/);
      if (match) declared.set(match[1] as string, match[2] as string);
    }
    return declared;
  }

  function expected({ l, c, h }: Oklch): string {
    return `oklch(${l} ${c} ${h})`;
  }

  it.each([
    ["light", ":root {"],
    ["dark", ".dark {"],
  ] as const)("applies the %s tokens", (theme, block) => {
    const declared = declaredIn(block);
    for (const [name, value] of Object.entries(themeTokens[theme])) {
      expect(declared.get(name), `--${name} in ${block}`).toBe(expected(value as Oklch));
    }
  });

  it("defines the motion duration tokens and honours reduced motion", () => {
    const declared = declaredIn(":root {");
    expect(declared.get("duration-fast")).toBe("120ms");
    expect(declared.get("duration-base")).toBe("200ms");
    expect(declared.get("duration-slow")).toBe("320ms");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("maps every token onto a Tailwind colour utility", () => {
    for (const name of Object.keys(themeTokens.light)) {
      expect(css, `--color-${name} mapping`).toContain(`--color-${name}: var(--${name});`);
    }
  });
});
