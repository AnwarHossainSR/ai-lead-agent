import { SESSION_COOKIE_NAME } from "@mela/config";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "./middleware";

/**
 * Task 8.2 / dashboard spec: "An unauthenticated visitor is sent to
 * sign-in." This is the cheap cookie-presence gate — `(workspace)/layout.tsx`
 * makes the authoritative check against the API, not tested here.
 */
describe("middleware", () => {
  it("redirects to /sign-in when no session cookie is present", () => {
    const request = new NextRequest("http://localhost:3000/");

    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in");
  });

  it("passes a request through when a session cookie is present", () => {
    const request = new NextRequest("http://localhost:3000/", {
      headers: new Headers({ cookie: `${SESSION_COOKIE_NAME}=some-token` }),
    });

    const response = middleware(request);

    expect(response.headers.get("location")).toBeNull();
  });

  it("never redirects the sign-in page itself, even with no cookie", () => {
    const request = new NextRequest("http://localhost:3000/sign-in");

    const response = middleware(request);

    expect(response.headers.get("location")).toBeNull();
  });
});
