import { SESSION_COOKIE_NAME } from "@mela/config";
import { insertAccount } from "@mela/database";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { accountInput } from "@mela/database/testing/fixtures";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestApp } from "../testing/app";
import { hashPassword } from "./password";

const KNOWN_PASSWORD = "a-strong-password-123";

let harness: TestDatabase;
let app: INestApplication | undefined;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  app = await createTestApp({ DATABASE_URL: harness.url });
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

afterAll(async () => {
  await harness?.close();
});

function cookieValue(setCookieHeader: string[] | undefined, name: string): string | undefined {
  const line = setCookieHeader?.find((entry) => entry.startsWith(`${name}=`));
  return line?.split(";")[0]?.split("=")[1];
}

describe("POST /api/auth/sign-in", () => {
  it("sets an HTTP-only, same-site session cookie and returns the account on success", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    const account = await insertAccount(
      harness.database,
      accountInput({ email: "operator@example.com", passwordHash, role: "operator" }),
    );

    const response = await request(app?.getHttpServer())
      .post("/api/auth/sign-in")
      .send({ email: "operator@example.com", password: KNOWN_PASSWORD })
      .expect(200);

    expect(response.body).toEqual({
      account: { id: account.id, email: "operator@example.com", role: "operator" },
    });

    const setCookie = response.headers["set-cookie"] as unknown as string[] | undefined;
    const cookieLine = setCookie?.find((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`));

    expect(cookieLine).toBeDefined();
    expect(cookieLine).toMatch(/HttpOnly/i);
    expect(cookieLine).toMatch(/SameSite=Lax/i);
  });

  it("marks the cookie Secure outside development and not in development", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    await insertAccount(
      harness.database,
      accountInput({ email: "secure-check@example.com", passwordHash }),
    );

    await app?.close();
    app = await createTestApp({ DATABASE_URL: harness.url, NODE_ENV: "development" });

    const devResponse = await request(app.getHttpServer())
      .post("/api/auth/sign-in")
      .send({ email: "secure-check@example.com", password: KNOWN_PASSWORD })
      .expect(200);
    const devCookie = (devResponse.headers["set-cookie"] as unknown as string[] | undefined)?.find(
      (entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`),
    );
    expect(devCookie).not.toMatch(/Secure/i);

    await app.close();
    app = await createTestApp({ DATABASE_URL: harness.url, NODE_ENV: "production" });

    const prodResponse = await request(app.getHttpServer())
      .post("/api/auth/sign-in")
      .send({ email: "secure-check@example.com", password: KNOWN_PASSWORD })
      .expect(200);
    const prodCookie = (
      prodResponse.headers["set-cookie"] as unknown as string[] | undefined
    )?.find((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(prodCookie).toMatch(/Secure/i);
  });

  it("refuses an unknown email with a generic message and no cookie", async () => {
    const response = await request(app?.getHttpServer())
      .post("/api/auth/sign-in")
      .send({ email: "nobody@example.com", password: "irrelevant" })
      .expect(401);

    expect(response.body.message).toBe("Incorrect email or password.");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("refuses a wrong password with the same generic message", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    await insertAccount(
      harness.database,
      accountInput({ email: "known@example.com", passwordHash }),
    );

    const response = await request(app?.getHttpServer())
      .post("/api/auth/sign-in")
      .send({ email: "known@example.com", password: "wrong-password" })
      .expect(401);

    expect(response.body.message).toBe("Incorrect email or password.");
  });

  it("rejects a request with no password", async () => {
    await request(app?.getHttpServer())
      .post("/api/auth/sign-in")
      .send({ email: "known@example.com" })
      .expect(400);
  });
});

describe("POST /api/auth/sign-out", () => {
  it("clears the cookie and revokes the session so it no longer validates", async () => {
    const passwordHash = await hashPassword(KNOWN_PASSWORD);
    await insertAccount(
      harness.database,
      accountInput({ email: "signout@example.com", passwordHash }),
    );

    const signInResponse = await request(app?.getHttpServer())
      .post("/api/auth/sign-in")
      .send({ email: "signout@example.com", password: KNOWN_PASSWORD })
      .expect(200);

    const setCookie = signInResponse.headers["set-cookie"] as unknown as string[] | undefined;
    const token = cookieValue(setCookie, SESSION_COOKIE_NAME);
    expect(token).toBeDefined();

    const signOutResponse = await request(app?.getHttpServer())
      .post("/api/auth/sign-out")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${token}`)
      .expect(200);

    const clearedCookie = (
      signOutResponse.headers["set-cookie"] as unknown as string[] | undefined
    )?.find((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(clearedCookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it("succeeds even when no session cookie is presented", async () => {
    await request(app?.getHttpServer()).post("/api/auth/sign-out").expect(200);
  });
});
