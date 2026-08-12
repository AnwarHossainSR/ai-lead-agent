import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { startFixtureServer, type FixtureServerHandle } from "../../testing/http-fixture-server";
import { createHttpCheck, type HttpClient } from "./http";
import type { CheckInput } from "../types";

let server: FixtureServerHandle;

function input(overrides?: Partial<CheckInput>): CheckInput {
  return {
    companyId: "019ff21c-0000-7000-8000-000000000001",
    domain: "example.com",
    websiteUrl: `${server?.url}/ok`,
    companyName: "Example Corp",
    timeoutMs: 5_000,
    ...overrides,
  };
}

/** Wraps globalThis.fetch to match the HttpClient interface. */
const nativeFetch: HttpClient = {
  async fetch(url, options) {
    const res = await globalThis.fetch(url, options);
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    return {
      status: res.status,
      headers,
      body: await res.text(),
      finalUrl: res.url,
    };
  },
};

beforeEach(async () => {
  server = await startFixtureServer();
});

afterEach(async () => {
  await server?.close();
});

describe("http check", () => {
  it("returns passed for a successful response", async () => {
    const check = createHttpCheck(nativeFetch);
    const result = await check.run(input());
    expect(result.verdict).toBe("passed");
    expect(result.evidence).toContain("200");
  });

  it("returns unknown when blocked with 403", async () => {
    const check = createHttpCheck(nativeFetch);
    const result = await check.run(input({ websiteUrl: `${server.url}/block/403` }));
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("blocked");
  });

  it("returns unknown when blocked with 429 without retry-after", async () => {
    const check = createHttpCheck(nativeFetch);
    const result = await check.run(input({ websiteUrl: `${server.url}/block/429` }));
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("blocked");
  });

  it("returns unknown when captcha is detected", async () => {
    const check = createHttpCheck(nativeFetch);
    const result = await check.run(input({ websiteUrl: `${server.url}/block/captcha` }));
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("blocked");
  });

  it("returns unknown on timeout", async () => {
    const check = createHttpCheck(nativeFetch);
    const result = await check.run(input({ websiteUrl: `${server.url}/slow`, timeoutMs: 50 }));
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("timeout");
  });

  it("returns failed for a 500 error", async () => {
    const check = createHttpCheck(nativeFetch);
    const result = await check.run(input({ websiteUrl: `${server.url}/error/500` }));
    expect(result.verdict).toBe("failed");
    expect(result.evidence).toContain("500");
  });

  it("returns unknown when no website URL is provided", async () => {
    const check = createHttpCheck(nativeFetch);
    const result = await check.run(input({ websiteUrl: undefined }));
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("no_website");
  });

  it("follows redirects and records the final URL", async () => {
    const check = createHttpCheck(nativeFetch);
    const result = await check.run(input({ websiteUrl: `${server.url}/redirect/301` }));
    expect(result.verdict).toBe("passed");
    expect(result.evidenceUrl).toContain("/ok");
  });
});

