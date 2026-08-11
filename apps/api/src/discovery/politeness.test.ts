import { describe, expect, it } from "vitest";

import * as blockDetection from "./block-detection";
import * as rateLimiter from "./rate-limiter";
import * as robots from "./robots";

/**
 * Task 4.4 — the absence is the control. The politeness module exists to slow
 * and stop, never to disguise. If it grows an evasion option — a proxy, a
 * user-agent rotation, a challenge solver, a retry through another network
 * path — this test fails and the design's stated constraint is re-examined.
 */
const FORBIDDEN_SURFACE = /(proxy|rotate|rotation|user-?agent|fingerprint|captcha|challenge.?solver|headless|retry)/i;

describe("the politeness module exposes no evasion options", () => {
  it("robots.ts exports nothing that could override or bypass a policy", () => {
    const exported = Object.keys(robots);
    expect(exported).toContain("parseRobotsTxt");
    expect(exported).toContain("RobotsService");
    expect(exported.some((name) => FORBIDDEN_SURFACE.test(name))).toBe(false);
  });

  it("rate-limiter.ts exports nothing that could disguise a request", () => {
    const exported = Object.keys(rateLimiter);
    expect(exported).toContain("TokenBucket");
    expect(exported).toContain("effectiveRequestIntervalMs");
    expect(exported.some((name) => FORBIDDEN_SURFACE.test(name))).toBe(false);
  });

  it("block-detection.ts only reports blocks and never a way around them", () => {
    const exported = Object.keys(blockDetection);
    expect(exported).toContain("detectBlock");
    expect(exported.some((name) => FORBIDDEN_SURFACE.test(name))).toBe(false);
  });

  it("the robots policy has no override flag", () => {
    const allowAll = Object.getOwnPropertyNames(robots.RobotsPolicy);
    expect(allowAll).not.toContain("override");

    const service = new robots.RobotsService({
      fetchRobotsTxt: async () => "User-agent: *",
    });
    expect(Object.getOwnPropertyNames(service)).not.toContain("proxy");
  });

  it("the block verdict leaves nowhere to go but blocked or not blocked", () => {
    const blocked = blockDetection.detectBlock(403, {}, "");
    expect(blocked).toEqual({ blocked: true, reason: "http_403" });
  });
});
