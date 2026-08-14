import { cookies } from "next/headers";

import { DEFAULT_THEME, THEME_COOKIE, type ThemePreference, themePreferenceFrom } from "./theme";

/** The stored preference, read while the server renders so the first paint is correct. */
export async function readThemePreference(): Promise<ThemePreference> {
  try {
    const store = await cookies();
    return themePreferenceFrom(store.get(THEME_COOKIE)?.value);
  } catch {
    // Outside a request scope — a unit test rendering the layout directly.
    return DEFAULT_THEME;
  }
}
