import { CONVENTIONAL_PATHS } from "@mela/config";

/**
 * A page fetched or skipped during research.
 */
export interface FetchedPage {
  readonly url: string;
  readonly html: string;
  readonly fetchedAt: Date;
}

export interface SkippedPage {
  readonly url: string;
  readonly reason: string;
}

/**
 * Configuration for page fetching.
 */
export interface PageFetcherConfig {
  readonly userAgent: string;
  readonly timeoutMs: number;
  readonly maxPages: number;
}

const DEFAULT_CONFIG: PageFetcherConfig = {
  userAgent: "MelaBot/1.0",
  timeoutMs: 30_000,
  maxPages: 20,
};

/**
 * Builds the list of URLs to fetch for a company.
 *
 * Combines the analysed pages with the configured conventional paths.
 */
export function buildFetchUrls(
  analysedUrls: readonly string[],
  baseUrl: string,
): readonly string[] {
  const urls: string[] = [...analysedUrls];

  for (const path of CONVENTIONAL_PATHS) {
    const url = new URL(path, baseUrl).toString();
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls.slice(0, DEFAULT_CONFIG.maxPages);
}

/**
 * Checks if a URL is allowed by robots.txt.
 *
 * This is a placeholder that always returns true — the actual
 * robots.txt checking is done by the PolitenessService.
 */
export function isUrlAllowed(_url: string, _userAgent: string): boolean {
  // In production, this would check robots.txt
  // For now, we assume all URLs are allowed
  return true;
}

/**
 * Fetches a page with timeout and error handling.
 *
 * Returns null if the fetch fails or times out.
 */
export async function fetchPage(
  url: string,
  config: PageFetcherConfig = DEFAULT_CONFIG,
): Promise<{ html: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    const response = await fetch(url, {
      headers: {
        "User-Agent": config.userAgent,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return { html };
  } catch {
    return null;
  }
}
