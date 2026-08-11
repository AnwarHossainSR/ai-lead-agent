/**
 * `robots.txt` handling (design D4).
 *
 * Politeness machinery lives in the request path, not in a policy document: a
 * source configured as crawlable cannot issue a request without first passing
 * the path through the policy fetched from that source's origin.
 *
 * The conservative default is a disallow: a file that cannot be fetched or
 * cannot be interpreted is treated as forbidding everything. Over-approving
 * is what gets a directory source (and the account behind it) blocked; under-
 * approving costs at most some candidates.
 */

export interface RobotsRule {
  readonly kind: "allow" | "disallow";
  readonly path: string;
}

export interface RobotsGroup {
  readonly userAgents: readonly string[];
  readonly rules: readonly RobotsRule[];
  readonly crawlDelaySeconds: number | null;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * A parsed `robots.txt` and the decisions it makes. Immutable; the run service
 * and any source hold one instance and ask it questions.
 */
export class RobotsPolicy {
  private constructor(private readonly groups: readonly RobotsGroup[]) {}

  static allowAll(): RobotsPolicy {
    return new RobotsPolicy([]);
  }

  static disallowAll(): RobotsPolicy {
    return new RobotsPolicy([{ userAgents: ["*"], rules: [{ kind: "disallow", path: "/" }], crawlDelaySeconds: null }]);
  }

  static fromGroups(groups: readonly RobotsGroup[]): RobotsPolicy {
    return new RobotsPolicy(groups);
  }

  private matchingGroups(userAgent: string): RobotsGroup[] {
    const wanted = userAgent.toLowerCase();

    return this.groups.filter(
      (group) =>
        group.userAgents.includes("*") ||
        group.userAgents.some((agent) => wanted.startsWith(agent)),
    );
  }

  /**
   * Whether a path may be requested. Groups that apply to our user agent are
   * combined; the rule whose path is the longest prefix of the target decides,
   * and a tie between an allow and a disallow resolves to allow (as Google's
   * crawler treats it). No matching rule means the path is allowed.
   */
  allows(path: string, userAgent: string): boolean {
    const groups = this.matchingGroups(userAgent);

    if (groups.length === 0) {
      return true;
    }

    let best: { kind: "allow" | "disallow"; length: number } | null = null;

    for (const group of groups) {
      for (const rule of group.rules) {
        if (!path.startsWith(rule.path)) {
          continue;
        }
        if (best === null || rule.path.length > best.length) {
          best = { kind: rule.kind, length: rule.path.length };
        } else if (rule.path.length === best.length && rule.kind === "allow") {
          // A tie between an allow and a disallow resolves to allow, as
          // Google's crawler treats it.
          best = { kind: rule.kind, length: rule.path.length };
        }
      }
    }

    return best === null || best.kind === "allow";
  }

  /**
   * The longest crawl-delay declared by any group applying to this user agent,
   * or `null` when none is declared. The run service spaces requests by
   * `max(configured interval, this)`.
   */
  crawlDelaySeconds(userAgent: string): number | null {
    let delay: number | null = null;

    for (const group of this.matchingGroups(userAgent)) {
      if (group.crawlDelaySeconds !== null) {
        delay = Math.max(delay ?? 0, group.crawlDelaySeconds);
      }
    }

    return delay;
  }
}

type RawGroup = { agents: string[]; rules: RobotsRule[]; delay: number | null };

function toGroup(raw: RawGroup): RobotsGroup {
  return {
    userAgents: raw.agents,
    rules: raw.rules,
    crawlDelaySeconds: raw.delay,
  };
}

/**
 * Parses `robots.txt`. An empty file is a valid file and permits everything; a
 * file with directives that never formed a user-agent group is malformed and
 * treated as disallowing everything. Both resolutions err toward the source
 * that hosts it, and a source explicitly configured as crawlable can be
 * re-checked by a human.
 */
export function parseRobotsTxt(content: string): RobotsPolicy {
  const groups: RobotsGroup[] = [];
  let current: RawGroup | null = null;
  let sawDirective = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]!.trim();

    if (line.length === 0) {
      continue;
    }

    const colon = line.indexOf(":");
    sawDirective = true;

    if (colon === -1) {
      continue;
    }

    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    switch (field) {
      case "user-agent":
        // Consecutive user-agent lines belong to one group; a user-agent line
        // after rules have started closes the previous group.
        if (current !== null && current.rules.length > 0) {
          groups.push(toGroup(current));
          current = null;
        }
        current ??= { agents: [], rules: [], delay: null };
        current.agents.push(value.toLowerCase());
        break;
      case "allow":
        if (current !== null) {
          current.rules.push({ kind: "allow", path: value });
        }
        break;
      case "disallow":
        // An empty disallow means nothing is disallowed — it is not a rule.
        if (current !== null && value.length > 0) {
          current.rules.push({ kind: "disallow", path: value });
        }
        break;
      case "crawl-delay": {
        const delay = Number.parseFloat(value);
        if (current !== null && Number.isFinite(delay) && delay > 0) {
          current.delay = Math.max(current.delay ?? 0, delay);
        }
        break;
      }
      default:
        // Sitemap and everything else is ignored: none of it permits or
        // forbids a path.
        break;
    }
  }

  if (current !== null) {
    groups.push(toGroup(current));
  }

  // An empty file is a valid robots.txt and permits everything. Only a file
  // with directives that never formed a group is malformed.
  if (!sawDirective) {
    return RobotsPolicy.allowAll();
  }

  return groups.length > 0 ? RobotsPolicy.fromGroups(groups) : RobotsPolicy.disallowAll();
}

/** How the module learns what a host says. Inject, never call out directly. */
export interface RobotsFetcher {
  fetchRobotsTxt(robotsUrl: string): Promise<string>;
}

/**
 * Fetches and caches a host's policy per origin (24-hour TTL). A host that
 * cannot be reached yields a disallow-all policy, so an outage at the host
 * never becomes permission to scrape it.
 */
export class RobotsService {
  private readonly cache = new Map<string, { fetchedAt: number; policy: RobotsPolicy }>();

  constructor(
    private readonly fetcher: RobotsFetcher,
    private readonly options: { ttlMs?: number; now?: () => number } = {},
  ) {}

  async policyFor(origin: string): Promise<RobotsPolicy> {
    const parsed = new URL(origin);
    const key = `${parsed.protocol}//${parsed.host}`;
    const ttlMs = this.options.ttlMs ?? DEFAULT_TTL_MS;
    const now = this.options.now ?? Date.now;

    const cached = this.cache.get(key);

    if (cached !== undefined && now() - cached.fetchedAt < ttlMs) {
      return cached.policy;
    }

    const policy = await this.fetchPolicy(key);
    this.cache.set(key, { fetchedAt: now(), policy });
    return policy;
  }

  private async fetchPolicy(origin: string): Promise<RobotsPolicy> {
    try {
      const content = await this.fetcher.fetchRobotsTxt(`${origin}/robots.txt`);
      return parseRobotsTxt(content);
    } catch {
      return RobotsPolicy.disallowAll();
    }
  }
}
