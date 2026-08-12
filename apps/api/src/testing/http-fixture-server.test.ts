import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { startFixtureServer, type FixtureServerHandle } from "./http-fixture-server";

let server: FixtureServerHandle;

beforeEach(async () => {
  server = await startFixtureServer();
});

afterEach(async () => {
  await server?.close();
});

async function GET(url: string): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const res = await fetch(url, { redirect: "manual" });
  const body = await res.text();
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });
  return { status: res.status, headers, body };
}

describe("HTTP fixture server", () => {
  it("serves /ok with 200", async () => {
    const { status, body } = await GET(`${server.url}/ok`);
    expect(status).toBe(200);
    expect(body).toContain("fixture");
  });

  it("returns 404 for unknown paths", async () => {
    const { status } = await GET(`${server.url}/nope`);
    expect(status).toBe(404);
  });

  it("serves a 403 block", async () => {
    const { status, body } = await GET(`${server.url}/block/403`);
    expect(status).toBe(403);
    expect(body).toBe("blocked");
  });

  it("serves a 429 without Retry-After", async () => {
    const { status, headers } = await GET(`${server.url}/block/429`);
    expect(status).toBe(429);
    expect(headers["retry-after"]).toBeUndefined();
  });

  it("serves a 429 with Retry-After", async () => {
    const { status, headers } = await GET(`${server.url}/block/429-retry`);
    expect(status).toBe(429);
    expect(headers["retry-after"]).toBe("120");
  });

  it("serves a captcha challenge", async () => {
    const { status, body } = await GET(`${server.url}/block/captcha`);
    expect(status).toBe(200);
    expect(body).toContain("captcha");
  });

  it("redirects with 301", async () => {
    const { status, headers } = await GET(`${server.url}/redirect/301`);
    expect(status).toBe(301);
    expect(headers.location).toBe("/ok");
  });

  it("returns 500 for /error/500", async () => {
    const { status } = await GET(`${server.url}/error/500`);
    expect(status).toBe(500);
  });
});
