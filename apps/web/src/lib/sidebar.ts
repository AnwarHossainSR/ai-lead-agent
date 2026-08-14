import { cookies } from "next/headers";

/**
 * Whether the sidebar is collapsed, persisted by the same cookie mechanism as
 * the theme (design D10) so the server renders it in the right state on the
 * first paint rather than expanding and then snapping shut.
 */
export const SIDEBAR_COOKIE = "mela_sidebar";

export async function readSidebarCollapsed(): Promise<boolean> {
  try {
    const store = await cookies();
    return store.get(SIDEBAR_COOKIE)?.value === "collapsed";
  } catch {
    return false;
  }
}
