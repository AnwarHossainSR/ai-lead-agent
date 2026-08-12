import { DEFAULT_FINGERPRINTS, type Fingerprint, type MatchLocation } from "@mela/config";

/**
 * A detection produced by matching a fingerprint against captured content.
 */
export interface Detection {
  readonly fingerprintId: string;
  readonly technologyId: string;
  readonly category: string;
  readonly certainty: "observed" | "inferred";
  readonly matchedIn: MatchLocation | null;
  readonly matchedText: string | null;
  readonly version: string | null;
  readonly impliedBy: string | null;
}

/**
 * A page capture to match against.
 */
export interface PageCapture {
  readonly url: string;
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly html: string;
  readonly scriptUrls: readonly string[];
  readonly stylesheetUrls: readonly string[];
  readonly cookieNames: readonly string[];
  readonly metaGenerator: string | null;
}

/**
 * Configuration for the matcher.
 */
export interface MatcherConfig {
  readonly maxHtmlBytes: number;
  readonly timeBudgetMs: number;
}

const DEFAULT_CONFIG: MatcherConfig = {
  maxHtmlBytes: 2 * 1024 * 1024, // 2MB
  timeBudgetMs: 5000,
};

/**
 * Extracts the match locations from a PageCapture.
 */
function extractLocations(
  capture: PageCapture,
  maxHtmlBytes: number,
): Record<MatchLocation, string> {
  return {
    header: Object.entries(capture.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
    html: capture.html.slice(0, maxHtmlBytes),
    script: capture.scriptUrls.join("\n"),
    stylesheet: capture.stylesheetUrls.join("\n"),
    cookie: capture.cookieNames.join("\n"),
    meta: capture.metaGenerator ?? "",
  };
}

/**
 * Matches a pattern against a location.
 */
function matchPattern(
  pattern: { in: MatchLocation; match: string; version?: number },
  locations: Record<MatchLocation, string>,
): { matched: boolean; text: string; version: string | null } | null {
  const locationText = locations[pattern.in];
  if (locationText === undefined || locationText === "") {
    return null;
  }

  try {
    const regex = new RegExp(pattern.match, "i");
    const match = regex.exec(locationText);

    if (match === null) {
      return null;
    }

    // Extract version if specified
    let version: string | null = null;
    if (pattern.version !== undefined && match[pattern.version] !== undefined) {
      version = match[pattern.version] ?? null;
    }

    return {
      matched: true,
      text: match[0],
      version,
    };
  } catch {
    return null;
  }
}

/**
 * The technology detection matcher.
 *
 * Matches fingerprints against page captures to detect technologies.
 * Runs deterministically with no network requests or model calls.
 */
export class MatcherService {
  private readonly fingerprints: readonly Fingerprint[];
  private readonly config: MatcherConfig;

  constructor(
    fingerprints: readonly Fingerprint[] = DEFAULT_FINGERPRINTS,
    config: Partial<MatcherConfig> = {},
  ) {
    this.fingerprints = Array.from(fingerprints);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Runs detection against a page capture.
   *
   * Returns detections in a deterministic order.
   * Respects time budget and HTML byte limits.
   */
  detect(capture: PageCapture): readonly Detection[] {
    const locations = extractLocations(capture, this.config.maxHtmlBytes);
    const detections: Detection[] = [];
    const matched = new Map<string, Detection>();
    const startTime = Date.now();

    // Evaluate fingerprints in stable declared order
    for (const fingerprint of this.fingerprints) {
      // Check time budget
      if (Date.now() - startTime > this.config.timeBudgetMs) {
        break;
      }

      // Try each pattern
      for (const pattern of fingerprint.patterns) {
        const result = matchPattern(pattern, locations);
        if (result !== null && result.matched) {
          // Record as observed
          const detection: Detection = {
            fingerprintId: fingerprint.id,
            technologyId: fingerprint.technology,
            category: fingerprint.category,
            certainty: "observed",
            matchedIn: pattern.in,
            matchedText: result.text,
            version: result.version,
            impliedBy: null,
          };

          matched.set(fingerprint.technology, detection);
          break; // Move to next fingerprint
        }
      }
    }

    // Resolve implications
    for (const detection of matched.values()) {
      const fingerprint = this.fingerprints.find((f) => f.id === detection.fingerprintId);

      if (fingerprint === undefined) {
        continue;
      }

      // Add the observed detection
      detections.push(detection);

      // Process implications
      this.resolveImplications(fingerprint.implies, matched, detections, detection.fingerprintId);
    }

    return detections;
  }

  /**
   * Resolves implications transitively.
   */
  private resolveImplications(
    implies: readonly string[],
    matched: Map<string, Detection>,
    detections: Detection[],
    impliedBy: string,
  ): void {
    for (const technologyId of implies) {
      // Check if already observed
      if (matched.has(technologyId)) {
        continue; // Don't downgrade
      }

      // Check if already inferred
      const existing = detections.find(
        (d) => d.technologyId === technologyId && d.certainty === "inferred",
      );
      if (existing !== undefined) {
        continue; // Already inferred
      }

      // Find the fingerprint for this technology (by ID or technology name)
      const fingerprint = this.fingerprints.find(
        (f) => f.id === technologyId || f.technology === technologyId,
      );
      if (fingerprint === undefined) {
        continue; // Unknown technology
      }

      // Record as inferred
      const detection: Detection = {
        fingerprintId: fingerprint.id,
        technologyId: fingerprint.technology,
        category: fingerprint.category,
        certainty: "inferred",
        matchedIn: null,
        matchedText: null,
        version: null,
        impliedBy,
      };

      detections.push(detection);

      // Recursively resolve implications
      this.resolveImplications(fingerprint.implies, matched, detections, fingerprint.id);
    }
  }
}
