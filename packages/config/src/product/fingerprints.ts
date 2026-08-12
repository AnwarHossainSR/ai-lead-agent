import { z } from "zod";

import { deepFreeze } from "../internal/freeze";
import { parseOrThrow } from "../internal/errors";

/**
 * Technology categories supported by the detection system.
 */
export const TECHNOLOGY_CATEGORIES = [
  "cms",
  "ecommerce",
  "framework",
  "page-builder",
  "analytics",
  "cdn",
  "payment",
  "hosting",
] as const;

export type TechnologyCategory = (typeof TECHNOLOGY_CATEGORIES)[number];

/**
 * Match locations derived from a PageCapture.
 */
export const MATCH_LOCATIONS = [
  "header",
  "html",
  "script",
  "stylesheet",
  "cookie",
  "meta",
] as const;

export type MatchLocation = (typeof MATCH_LOCATIONS)[number];

/**
 * A pattern for detecting a technology.
 */
export const patternSchema = z.object({
  in: z.enum(MATCH_LOCATIONS),
  match: z.string().min(1, "Pattern match must not be empty"),
  version: z.number().int().positive().optional(),
});

export type Pattern = z.infer<typeof patternSchema>;

/**
 * A technology fingerprint.
 */
export const fingerprintSchema = z.object({
  id: z.string().min(1, "Fingerprint ID must not be empty"),
  technology: z.string().min(1, "Technology name must not be empty"),
  category: z.enum(TECHNOLOGY_CATEGORIES),
  patterns: z.array(patternSchema).min(1, "Fingerprint must have at least one pattern"),
  implies: z.array(z.string()),
});

export type Fingerprint = z.infer<typeof fingerprintSchema>;

/**
 * Checks if a regex pattern has nested unbounded repetition (catastrophic backtracking).
 */
function hasCatastrophicBacktracking(pattern: string): boolean {
  // Check for nested quantifiers: (a+)+, (a*)*, (a+)*, (a*)+, etc.
  const nestedQuantifierPattern = /\([^)]*[+*][^)]*\)[+*]/;
  return nestedQuantifierPattern.test(pattern);
}

/**
 * Validates a list of fingerprints, checking for:
 * - Duplicate identifiers
 * - Empty pattern lists
 * - Invalid regex patterns
 * - Unknown categories
 * - Implication cycles
 * - Catastrophic backtracking patterns
 */
export function parseFingerprints(input: unknown): readonly Fingerprint[] {
  const fingerprints = z.array(fingerprintSchema).parse(input);

  // Check for duplicate identifiers
  const ids = new Set<string>();
  for (const fp of fingerprints) {
    if (ids.has(fp.id)) {
      throw new Error(`Duplicate fingerprint identifier: ${fp.id}`);
    }
    ids.add(fp.id);
  }

  // Validate each fingerprint
  for (const fp of fingerprints) {
    // Check for empty patterns (already handled by zod, but double-check)
    if (fp.patterns.length === 0) {
      throw new Error(`Fingerprint '${fp.id}' has no patterns`);
    }

    // Check each pattern
    for (const pattern of fp.patterns) {
      // Check for invalid regex
      try {
        new RegExp(pattern.match);
      } catch {
        throw new Error(`Fingerprint '${fp.id}' has invalid pattern: ${pattern.match}`);
      }

      // Check for catastrophic backtracking
      if (hasCatastrophicBacktracking(pattern.match)) {
        throw new Error(
          `Fingerprint '${fp.id}' has pattern with potential catastrophic backtracking: ${pattern.match}`,
        );
      }
    }
  }

  // Check for implication cycles using DFS
  const graph = new Map<string, string[]>();
  for (const fp of fingerprints) {
    graph.set(fp.id, fp.implies);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycle: string[] = [];

  function dfs(node: string, path: string[]): boolean {
    if (inStack.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node);
      cycle.push(...path.slice(cycleStart), node);
      return true;
    }
    if (visited.has(node)) {
      return false;
    }

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor, path)) {
        return true;
      }
    }

    path.pop();
    inStack.delete(node);
    return false;
  }

  for (const fp of fingerprints) {
    if (!visited.has(fp.id)) {
      if (dfs(fp.id, [])) {
        throw new Error(`Implication cycle detected: ${cycle.join(" → ")}`);
      }
    }
  }

  return fingerprints;
}

/**
 * Resolves a fingerprint by its identifier.
 */
export function resolveFingerprint(
  fingerprints: readonly Fingerprint[],
  id: string,
): Fingerprint | undefined {
  const fp = fingerprints.find((f) => f.id === id);
  if (fp === undefined) {
    const configured = fingerprints.map((f) => f.id).join(", ");
    throw new Error(`Unknown fingerprint: ${id}. Configured fingerprints: ${configured}`);
  }
  return fp;
}

/**
 * The default fingerprint set covering common technologies.
 */
export const DEFAULT_FINGERPRINTS = deepFreeze(
  parseFingerprints([
    // CMS
    {
      id: "wordpress",
      technology: "WordPress",
      category: "cms",
      patterns: [
        { in: "html", match: "wp-content" },
        { in: "html", match: "wp-includes" },
        { in: "meta", match: "generator.*WordPress", version: 1 },
      ],
      implies: ["php"],
    },
    {
      id: "drupal",
      technology: "Drupal",
      category: "cms",
      patterns: [
        { in: "html", match: "Drupal\\.settings" },
        { in: "html", match: "/sites/default/files" },
        { in: "meta", match: "generator.*Drupal", version: 1 },
      ],
      implies: ["php"],
    },
    {
      id: "joomla",
      technology: "Joomla",
      category: "cms",
      patterns: [
        { in: "html", match: "/media/jui/" },
        { in: "html", match: "Joomla!" },
      ],
      implies: ["php"],
    },

    // E-commerce
    {
      id: "woocommerce",
      technology: "WooCommerce",
      category: "ecommerce",
      patterns: [
        { in: "html", match: "woocommerce" },
        { in: "script", match: "/plugins/woocommerce/" },
        { in: "cookie", match: "^woocommerce_" },
      ],
      implies: ["wordpress"],
    },
    {
      id: "shopify",
      technology: "Shopify",
      category: "ecommerce",
      patterns: [
        { in: "html", match: "cdn\\.shopify\\.com" },
        { in: "header", match: "x-shopify-stage" },
        { in: "cookie", match: "^_shopify_" },
      ],
      implies: [],
    },
    {
      id: "magento",
      technology: "Magento",
      category: "ecommerce",
      patterns: [
        { in: "html", match: "Mage\\." },
        { in: "html", match: "/skin/frontend/" },
        { in: "cookie", match: "^frontend" },
      ],
      implies: ["php"],
    },

    // Frameworks
    {
      id: "react",
      technology: "React",
      category: "framework",
      patterns: [
        { in: "html", match: "react" },
        { in: "script", match: "react\\.js" },
        { in: "script", match: "react\\.production\\.min\\.js" },
      ],
      implies: ["javascript"],
    },
    {
      id: "vue",
      technology: "Vue.js",
      category: "framework",
      patterns: [
        { in: "html", match: "vue\\.js" },
        { in: "html", match: "data-v-" },
        { in: "script", match: "vue\\.production\\.min\\.js" },
      ],
      implies: ["javascript"],
    },
    {
      id: "angular",
      technology: "Angular",
      category: "framework",
      patterns: [
        { in: "html", match: "ng-version" },
        { in: "html", match: "angular\\.js" },
        { in: "script", match: "angular\\.min\\.js" },
      ],
      implies: ["javascript"],
    },

    // Page builders
    {
      id: "elementor",
      technology: "Elementor",
      category: "page-builder",
      patterns: [
        { in: "html", match: "elementor" },
        { in: "html", match: "data-elementor-type" },
      ],
      implies: ["wordpress"],
    },
    {
      id: "divi",
      technology: "Divi",
      category: "page-builder",
      patterns: [
        { in: "html", match: "divi" },
        { in: "html", match: "et_pb_" },
      ],
      implies: ["wordpress"],
    },

    // Analytics
    {
      id: "google-analytics",
      technology: "Google Analytics",
      category: "analytics",
      patterns: [
        { in: "script", match: "google-analytics\\.com/analytics\\.js" },
        { in: "script", match: "googletagmanager\\.com/gtag" },
      ],
      implies: [],
    },
    {
      id: "google-tag-manager",
      technology: "Google Tag Manager",
      category: "analytics",
      patterns: [
        { in: "script", match: "googletagmanager\\.com/gtm\\.js" },
        { in: "html", match: "GTM-" },
      ],
      implies: [],
    },
    {
      id: "hotjar",
      technology: "Hotjar",
      category: "analytics",
      patterns: [
        { in: "script", match: "static\\.hotjar\\.com" },
      ],
      implies: [],
    },

    // CDNs
    {
      id: "cloudflare",
      technology: "Cloudflare",
      category: "cdn",
      patterns: [
        { in: "header", match: "cf-ray" },
        { in: "header", match: "server.*cloudflare" },
      ],
      implies: [],
    },
    {
      id: "cloudfront",
      technology: "Amazon CloudFront",
      category: "cdn",
      patterns: [
        { in: "header", match: "x-amz-cf-id" },
        { in: "header", match: "server.*cloudfront" },
      ],
      implies: ["aws"],
    },

    // Payment
    {
      id: "stripe",
      technology: "Stripe",
      category: "payment",
      patterns: [
        { in: "script", match: "js\\.stripe\\.com" },
        { in: "html", match: "stripe" },
      ],
      implies: [],
    },
    {
      id: "paypal",
      technology: "PayPal",
      category: "payment",
      patterns: [
        { in: "script", match: "paypal\\.com/sdk/js" },
      ],
      implies: [],
    },

    // Hosting
    {
      id: "aws",
      technology: "Amazon Web Services",
      category: "hosting",
      patterns: [
        { in: "header", match: "x-amz-" },
      ],
      implies: [],
    },
    {
      id: "php",
      technology: "PHP",
      category: "hosting",
      patterns: [
        { in: "header", match: "x-powered-by.*PHP", version: 1 },
        { in: "cookie", match: "PHPSESSID" },
      ],
      implies: [],
    },
    {
      id: "javascript",
      technology: "JavaScript",
      category: "hosting",
      patterns: [
        { in: "html", match: "<script" },
      ],
      implies: [],
    },
  ]),
);
