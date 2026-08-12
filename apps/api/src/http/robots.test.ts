import { describe, expect, it } from "vitest";

import { RobotsPolicy, RobotsService, parseRobotsTxt } from "./robots";

describe("parseRobotsTxt", () => {
  it("treats an empty file as permitting everything", () => {
    const policy = parseRobotsTxt("");

    expect(policy.allows("/", "mela-bot/1.0")).toBe(true);
  });

  it("treats a file with no recognisable directives as malformed and disallowing everything", () => {
    const policy = parseRobotsTxt("not robots at all\njust words");

    expect(policy.allows("/", "mela-bot/1.0")).toBe(false);
  });

  it("allows paths not covered by a disallow", () => {
    const policy = parseRobotsTxt("User-agent: *\nDisallow: /private/");

    expect(policy.allows("/private/notes", "mela-bot/1.0")).toBe(false);
    expect(policy.allows("/public", "mela-bot/1.0")).toBe(true);
  });

  it("lets the longest matching rule decide", () => {
    const policy = parseRobotsTxt("User-agent: *\nDisallow: /private/\nAllow: /private/public");

    expect(policy.allows("/private/public/1", "mela-bot/1.0")).toBe(true);
    expect(policy.allows("/private/notes", "mela-bot/1.0")).toBe(false);
  });

  it("resolves an equal-length allow and disallow in favour of allow", () => {
    const policy = parseRobotsTxt("User-agent: *\nDisallow: /x\nAllow: /x");

    expect(policy.allows("/x", "mela-bot/1.0")).toBe(true);
  });

  it("only applies groups whose user agent matches", () => {
    const policy = parseRobotsTxt("User-agent: other-bot\nDisallow: /");

    expect(policy.allows("/", "mela-bot/1.0")).toBe(true);
    expect(policy.allows("/", "other-bot/1.0")).toBe(false);
  });

  it("matches user agents by prefix", () => {
    const policy = parseRobotsTxt("User-agent: mela\nDisallow: /");

    expect(policy.allows("/", "mela-bot/1.0")).toBe(false);
  });

  it("ignores unknown directives inside a group", () => {
    const policy = parseRobotsTxt(
      "User-agent: *\nDisallow: /private/\nSitemap: https://example.com/sitemap.xml",
    );

    expect(policy.allows("/private/notes", "mela-bot/1.0")).toBe(false);
    expect(policy.allows("/public", "mela-bot/1.0")).toBe(true);
  });

  it("treats a file with directives but no user-agent group as malformed", () => {
    const policy = parseRobotsTxt("Sitemap: https://example.com/sitemap.xml");

    expect(policy.allows("/", "mela-bot/1.0")).toBe(false);
  });

  it("reads the declared crawl delay from the matching group", () => {
    const policy = parseRobotsTxt(
      "User-agent: mela\nDisallow: /a\nCrawl-delay: 5\nUser-agent: other\nDisallow: /b\nCrawl-delay: 0.5",
    );

    expect(policy.crawlDelaySeconds("mela-bot/1.0")).toBe(5);
    expect(policy.crawlDelaySeconds("other-bot/1.0")).toBe(0.5);
  });

  it("reports no crawl delay when none is declared", () => {
    const policy = parseRobotsTxt("User-agent: *\nDisallow: /");

    expect(policy.crawlDelaySeconds("mela-bot/1.0")).toBeNull();
  });

  it("combines crawl delays from multiple matching groups by taking the longest", () => {
    const policy = parseRobotsTxt(
      "User-agent: mela\nCrawl-delay: 3\nUser-agent: *\nCrawl-delay: 7",
    );

    expect(policy.crawlDelaySeconds("mela-bot/1.0")).toBe(7);
  });

  it("exposes no way to construct an unparsed policy", () => {
    // RobotsPolicy's constructor is private; only the three factories exist.
    expect(RobotsPolicy.allowAll().allows("/", "mela-bot/1.0")).toBe(true);
    expect(RobotsPolicy.disallowAll().allows("/", "mela-bot/1.0")).toBe(false);
  });
});

describe("RobotsService", () => {
  it("caches a policy per origin within the TTL", async () => {
    let fetches = 0;
    const service = new RobotsService({
      fetchRobotsTxt: async () => {
        fetches += 1;
        return "User-agent: *\nDisallow: /private/";
      },
    });

    await service.policyFor("https://example.com");
    await service.policyFor("https://example.com");
    await service.policyFor("https://www.example.com");

    expect(fetches).toBe(2);
  });

  it("treats an unreachable host as disallowing everything", async () => {
    const service = new RobotsService({
      fetchRobotsTxt: async () => {
        throw new Error("connection refused");
      },
    });

    const policy = await service.policyFor("https://example.com");

    expect(policy.allows("/", "mela-bot/1.0")).toBe(false);
  });

  it("honours the configured TTL", async () => {
    let fetches = 0;
    let now = 0;
    const service = new RobotsService(
      {
        fetchRobotsTxt: async () => {
          fetches += 1;
          return "User-agent: *";
        },
      },
      { ttlMs: 100, now: () => now },
    );

    await service.policyFor("https://example.com");
    now = 50;
    await service.policyFor("https://example.com");
    now = 101;
    await service.policyFor("https://example.com");

    expect(fetches).toBe(2);
  });

  it("keys the cache by origin, not path", async () => {
    let fetches = 0;
    const service = new RobotsService({
      fetchRobotsTxt: async () => {
        fetches += 1;
        return "User-agent: *";
      },
    });

    await service.policyFor("https://example.com");
    await service.policyFor("https://example.com/directory/listing");

    expect(fetches).toBe(1);
  });
});
