/**
 * The theme preference (design D4).
 *
 * It lives in a cookie rather than `localStorage` because the server renders
 * the first paint: reading it here means `<html>` already carries the right
 * class, so the other theme is never briefly visible and no blocking inline
 * script is needed to correct it.
 *
 * `system` writes no class at all — `globals.css` selects the dark tokens under
 * `prefers-color-scheme: dark` for any root that is not explicitly `.light`, so
 * the OS preference is honoured with no JavaScript.
 *
 * The theme toggle is a Client Component and imports from here, so this module
 * stays free of `next/headers`; reading the cookie lives in `theme.server.ts`.
 */
export const THEME_COOKIE = "mela_theme";

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const DEFAULT_THEME: ThemePreference = "system";

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && THEME_PREFERENCES.includes(value as ThemePreference);
}

/** The class `<html>` carries — nothing at all for `system`. */
export function themeClass(preference: ThemePreference): string {
  return preference === "system" ? "" : preference;
}

/** Tells the browser which scheme to use for its own form controls and scrollbars. */
export function themeColorScheme(preference: ThemePreference): string {
  return preference === "system" ? "light dark" : preference;
}

/** The next preference in the light → dark → system cycle. */
export function nextThemePreference(preference: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(preference);
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length] as ThemePreference;
}

/** The preference a stored cookie value stands for, defaulting when it is unrecognised. */
export function themePreferenceFrom(value: string | undefined): ThemePreference {
  return isThemePreference(value) ? value : DEFAULT_THEME;
}
