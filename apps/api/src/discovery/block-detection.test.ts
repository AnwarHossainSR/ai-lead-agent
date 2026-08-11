import { describe, expect, it } from "vitest";

import { detectBlock } from "./block-detection";

const EMPTY_HEADERS = {};

describe("detectBlock", () => {
  it("treats an HTTP 403 as a block", () => {
    expect(detectBlock(403, EMPTY_HEADERS, "")).toEqual({
      blocked: true,
      reason: "http_403",
    });
  });

  it("treats a 429 without retry-after as a block", () => {
    expect(detectBlock(429, EMPTY_HEADERS, "")).toEqual({
      blocked: true,
      reason: "http_429_without_retry_after",
    });
  });

  it("does not treat a 429 with retry-after as a block", () => {
    expect(detectBlock(429, { "retry-after": "120" }, "")).toEqual({ blocked: false });
  });

  it("treats a response body matching a bot-challenge signature as a block", () => {
    expect(detectBlock(200, EMPTY_HEADERS, "Verify you are human to continue")).toEqual({
      blocked: true,
      reason: "bot_challenge",
    });
  });

  it("treats a captcha challenge as a block", () => {
    expect(detectBlock(200, EMPTY_HEADERS, "<html><title>CAPTCHA</title></html>")).toEqual({
      blocked: true,
      reason: "bot_challenge",
    });
  });

  it("does not block an ordinary successful response", () => {
    expect(detectBlock(200, EMPTY_HEADERS, "<html><h1>Companies</h1></html>")).toEqual({
      blocked: false,
    });
  });

  it("matches signatures case-insensitively", () => {
    expect(detectBlock(200, EMPTY_HEADERS, "Attention Required! Cloudflare")).toEqual({
      blocked: true,
      reason: "bot_challenge",
    });
  });
});
