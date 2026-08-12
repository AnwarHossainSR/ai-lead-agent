/**
 * Observation rules that check a page capture for issues.
 *
 * Each rule is a pure function from PageCapture to observations.
 * No browser involved - rules work on captured data.
 */

export interface PageCapture {
  url: string;
  status: number;
  headers: Record<string, string>;
  html: string;
  consoleMessages: Array<{ type: string; text: string }>;
  failedRequests: Array<{ url: string; error: string }>;
  transferSize: number;
}

export interface Observation {
  description: string;
  url: string;
  observedAt: string;
  certainty: "observed";
}

export type ObservationRule = (capture: PageCapture) => Observation[];

/**
 * No HTTPS check
 */
export const noHttpsRule: ObservationRule = (capture) => {
  if (!capture.url.startsWith("https://")) {
    return [
      {
        description: "Site is served without HTTPS",
        url: capture.url,
        observedAt: new Date().toISOString(),
        certainty: "observed",
      },
    ];
  }
  return [];
};

/**
 * Missing viewport meta check
 */
export const missingViewportMetaRule: ObservationRule = (capture) => {
  if (!capture.html.includes("viewport")) {
    return [
      {
        description: "Page is missing viewport meta tag",
        url: capture.url,
        observedAt: new Date().toISOString(),
        certainty: "observed",
      },
    ];
  }
  return [];
};

/**
 * Console errors check
 */
export const consoleErrorsRule: ObservationRule = (capture) => {
  const errors = capture.consoleMessages.filter((m) => m.type === "error");
  if (errors.length > 0) {
    return [
      {
        description: `Page has ${errors.length} console error(s)`,
        url: capture.url,
        observedAt: new Date().toISOString(),
        certainty: "observed",
      },
    ];
  }
  return [];
};

/**
 * Failed requests check
 */
export const failedRequestsRule: ObservationRule = (capture) => {
  if (capture.failedRequests.length > 0) {
    return [
      {
        description: `Page has ${capture.failedRequests.length} failed request(s)`,
        url: capture.url,
        observedAt: new Date().toISOString(),
        certainty: "observed",
      },
    ];
  }
  return [];
};

/**
 * Missing title check
 */
export const missingTitleRule: ObservationRule = (capture) => {
  if (!capture.html.includes("<title") || capture.html.includes("<title></title>")) {
    return [
      {
        description: "Page is missing or has empty title",
        url: capture.url,
        observedAt: new Date().toISOString(),
        certainty: "observed",
      },
    ];
  }
  return [];
};

/**
 * Missing meta description check
 */
export const missingMetaDescriptionRule: ObservationRule = (capture) => {
  if (
    !capture.html.includes('name="description"') &&
    !capture.html.includes("name='description'")
  ) {
    return [
      {
        description: "Page is missing meta description",
        url: capture.url,
        observedAt: new Date().toISOString(),
        certainty: "observed",
      },
    ];
  }
  return [];
};

/**
 * Missing favicon check
 */
export const missingFaviconRule: ObservationRule = (capture) => {
  if (!capture.html.includes("icon") && !capture.html.includes("favicon")) {
    return [
      {
        description: "Page is missing favicon link",
        url: capture.url,
        observedAt: new Date().toISOString(),
        certainty: "observed",
      },
    ];
  }
  return [];
};

/**
 * Excessive page weight check (10MB)
 */
const MAX_PAGE_WEIGHT = 10 * 1024 * 1024;

export const excessivePageWeightRule: ObservationRule = (capture) => {
  if (capture.transferSize > MAX_PAGE_WEIGHT) {
    return [
      {
        description: `Page weight (${capture.transferSize} bytes) exceeds ${MAX_PAGE_WEIGHT} bytes`,
        url: capture.url,
        observedAt: new Date().toISOString(),
        certainty: "observed",
      },
    ];
  }
  return [];
};

/**
 * All observation rules
 */
export const OBSERVATION_RULES: ObservationRule[] = [
  noHttpsRule,
  missingViewportMetaRule,
  consoleErrorsRule,
  failedRequestsRule,
  missingTitleRule,
  missingMetaDescriptionRule,
  missingFaviconRule,
  excessivePageWeightRule,
];

/**
 * Run all observation rules against a page capture
 */
export function runObservationRules(capture: PageCapture): Observation[] {
  const observations: Observation[] = [];
  for (const rule of OBSERVATION_RULES) {
    observations.push(...rule(capture));
  }
  return observations;
}
