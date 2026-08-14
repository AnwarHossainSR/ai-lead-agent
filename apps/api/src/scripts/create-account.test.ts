import { AUTHENTICATION_CONFIG } from "@mela/config";
import { describe, expect, it, vi } from "vitest";

import { parseArgs, readNewPassword } from "./create-account";

/**
 * Tests for task 6.1's documented account-creation command. `readSecret`
 * itself (real terminal input, echo disabled via raw mode) isn't exercised
 * here — it refuses to run at all without a real TTY, which is exactly
 * `readNewPassword`'s `readSecretFn` parameter exists to route around: a
 * fake stands in for it so the weak-password and confirmation-mismatch
 * logic can be tested without one.
 */

describe("parseArgs", () => {
  it("parses a valid email and role", () => {
    expect(parseArgs(["--email=operator@example.com", "--role=operator"])).toEqual({
      email: "operator@example.com",
      role: "operator",
    });
  });

  it("refuses a missing email with a usage message", () => {
    expect(() => parseArgs(["--role=operator"])).toThrow(/Usage: create-account/);
  });

  it("refuses a blank email", () => {
    expect(() => parseArgs(["--email=", "--role=operator"])).toThrow(/Usage: create-account/);
  });

  it("refuses a missing or unrecognised role, naming the allowed ones", () => {
    expect(() => parseArgs(["--email=operator@example.com"])).toThrow(
      /Expected --role to be one of: operator, viewer/,
    );
    expect(() => parseArgs(["--email=operator@example.com", "--role=admin"])).toThrow(
      /Expected --role to be one of: operator, viewer/,
    );
  });
});

describe("readNewPassword", () => {
  const validPassword = "a".repeat(AUTHENTICATION_CONFIG.minimumPasswordLength);

  it("returns the password once its confirmation matches", async () => {
    const readSecretFn = vi.fn().mockResolvedValue(validPassword);

    await expect(readNewPassword(readSecretFn)).resolves.toBe(validPassword);
    expect(readSecretFn).toHaveBeenNthCalledWith(1, "Password: ");
    expect(readSecretFn).toHaveBeenNthCalledWith(2, "Confirm password: ");
  });

  it("refuses a password shorter than the configured minimum, before asking for confirmation", async () => {
    const tooShort = "a".repeat(AUTHENTICATION_CONFIG.minimumPasswordLength - 1);
    const readSecretFn = vi.fn().mockResolvedValue(tooShort);

    await expect(readNewPassword(readSecretFn)).rejects.toThrow(
      `The password must be at least ${AUTHENTICATION_CONFIG.minimumPasswordLength} characters.`,
    );
    expect(readSecretFn).toHaveBeenCalledTimes(1);
  });

  it("refuses a confirmation that does not match the password", async () => {
    const readSecretFn = vi
      .fn()
      .mockResolvedValueOnce(validPassword)
      .mockResolvedValueOnce(`${validPassword}-different`);

    await expect(readNewPassword(readSecretFn)).rejects.toThrow(
      "The password and its confirmation did not match.",
    );
  });
});
