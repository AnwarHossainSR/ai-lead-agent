import { type INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createTestApp } from "./testing/app";

const WEB_ORIGIN = "http://localhost:3000";

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("CORS", () => {
  it("permits the configured web origin", async () => {
    app = await createTestApp({ WEB_ORIGIN });

    const response = await request(app.getHttpServer())
      .get("/health")
      .set("Origin", WEB_ORIGIN)
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe(WEB_ORIGIN);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("never reflects a different origin back, and never a wildcard", async () => {
    app = await createTestApp({ WEB_ORIGIN });

    const other = "http://not-the-web-app.example";
    const response = await request(app.getHttpServer())
      .get("/health")
      .set("Origin", other)
      .expect(200);

    // The configured origin is a fixed string, so it is what goes out no
    // matter who asked. The browser compares it against the page's own origin
    // and refuses to hand over the response when they differ.
    //
    // What this asserts is that the API neither echoes the caller's origin
    // back — which would permit every origin while looking restrictive — nor
    // answers with `*`.
    expect(response.headers["access-control-allow-origin"]).toBe(WEB_ORIGIN);
    expect(response.headers["access-control-allow-origin"]).not.toBe(other);
    expect(response.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("answers a preflight from the configured origin", async () => {
    app = await createTestApp({ WEB_ORIGIN });

    const response = await request(app.getHttpServer())
      .options("/health")
      .set("Origin", WEB_ORIGIN)
      .set("Access-Control-Request-Method", "GET");

    expect(response.status).toBeLessThan(300);
    expect(response.headers["access-control-allow-origin"]).toBe(WEB_ORIGIN);
  });
});
