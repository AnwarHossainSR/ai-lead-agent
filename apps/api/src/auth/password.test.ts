import { describe, expect, it } from "vitest";

import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("verifies a password against its own hash", async () => {
    const hash = await hashPassword("a-real-password-123");

    await expect(verifyPassword(hash, "a-real-password-123")).resolves.toBe(true);
  });

  it("refuses the wrong password", async () => {
    const hash = await hashPassword("a-real-password-123");

    await expect(verifyPassword(hash, "a-different-password")).resolves.toBe(false);
  });

  it("never stores the password itself in the hash", async () => {
    const hash = await hashPassword("a-recognisable-password-value");

    expect(hash).not.toContain("a-recognisable-password-value");
  });

  it("produces a different hash for the same password each time (a fresh salt)", async () => {
    const first = await hashPassword("same-password");
    const second = await hashPassword("same-password");

    expect(first).not.toBe(second);
  });
});

describe("DUMMY_PASSWORD_HASH", () => {
  it("is a valid Argon2id hash that verifies against no real password", async () => {
    await expect(verifyPassword(DUMMY_PASSWORD_HASH, "anything")).resolves.toBe(false);
    await expect(verifyPassword(DUMMY_PASSWORD_HASH, "")).resolves.toBe(false);
  });

  it("costs roughly the same to compare as a real hash (same Argon2id parameters)", async () => {
    const realHash = await hashPassword("a-real-password-123");

    const start1 = performance.now();
    await verifyPassword(realHash, "wrong-guess");
    const realElapsed = performance.now() - start1;

    const start2 = performance.now();
    await verifyPassword(DUMMY_PASSWORD_HASH, "wrong-guess");
    const dummyElapsed = performance.now() - start2;

    // Generous bound: this asserts the two are the same order of magnitude,
    // not a precise timing-attack proof, which a unit test cannot give.
    expect(dummyElapsed).toBeLessThan(realElapsed * 5 + 200);
    expect(realElapsed).toBeLessThan(dummyElapsed * 5 + 200);
  });
});
