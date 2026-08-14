import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_THEME,
  THEME_COOKIE,
  type ThemePreference,
  isThemePreference,
  nextThemePreference,
  themeClass,
  themeColorScheme,
  themePreferenceFrom,
} from "./theme";

const store = { get: vi.fn() };

vi.mock("next/headers", () => ({
  cookies: async () => store,
}));

import { readThemePreference } from "./theme.server";

describe("theme preference", () => {
  it("round-trips a stored choice", async () => {
    for (const preference of ["light", "dark", "system"] as ThemePreference[]) {
      store.get.mockReturnValue({ value: preference });
      await expect(readThemePreference()).resolves.toBe(preference);
    }

    expect(store.get).toHaveBeenCalledWith(THEME_COOKIE);
  });

  it("falls back to the default when no choice is stored", async () => {
    store.get.mockReturnValue(undefined);
    await expect(readThemePreference()).resolves.toBe(DEFAULT_THEME);
  });

  it("ignores an unrecognised cookie value", () => {
    expect(themePreferenceFrom("sepia")).toBe(DEFAULT_THEME);
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference("dark")).toBe(true);
  });

  it("writes the class the first paint needs", () => {
    expect(themeClass("dark")).toBe("dark");
    expect(themeClass("light")).toBe("light");
    // `system` writes nothing: the OS preference is honoured by the stylesheet.
    expect(themeClass("system")).toBe("");
  });

  it("tells the browser which scheme to render its own controls in", () => {
    expect(themeColorScheme("dark")).toBe("dark");
    expect(themeColorScheme("light")).toBe("light");
    expect(themeColorScheme("system")).toBe("light dark");
  });

  it("cycles light, dark, then system", () => {
    expect(nextThemePreference("light")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("system");
    expect(nextThemePreference("system")).toBe("light");
  });
});
