"use server";

import { cookies } from "next/headers";

import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import { THEME_COOKIE, type ThemePreference, isThemePreference } from "@/lib/theme";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Persists a theme choice. The control has already applied it in the browser,
 * so this only makes the choice survive a reload — and, because the server
 * reads the cookie when rendering, makes the next first paint correct.
 */
export async function setThemePreferenceAction(preference: ThemePreference): Promise<void> {
  if (!isThemePreference(preference)) return;

  const store = await cookies();
  store.set(THEME_COOKIE, preference, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
}

/** Persists whether the sidebar is collapsed, by the same mechanism (design D10). */
export async function setSidebarCollapsedAction(collapsed: boolean): Promise<void> {
  const store = await cookies();
  store.set(SIDEBAR_COOKIE, collapsed ? "collapsed" : "expanded", {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
}
