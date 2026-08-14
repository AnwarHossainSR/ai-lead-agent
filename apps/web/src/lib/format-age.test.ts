import { describe, expect, it } from "vitest";

import { formatAge } from "./format-age";

describe("formatAge", () => {
  const now = new Date("2026-01-10T12:00:00Z");

  it("renders under a minute as just now", () => {
    expect(formatAge("2026-01-10T11:59:30Z", now)).toBe("just now");
  });

  it("renders minutes when under an hour", () => {
    expect(formatAge("2026-01-10T11:45:00Z", now)).toBe("15m ago");
  });

  it("renders hours when under a day", () => {
    expect(formatAge("2026-01-10T06:00:00Z", now)).toBe("6h ago");
  });

  it("renders days for anything older", () => {
    expect(formatAge("2026-01-01T12:00:00Z", now)).toBe("9d ago");
  });
});
