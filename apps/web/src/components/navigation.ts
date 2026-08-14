import {
  BarChart3Icon,
  BuildingIcon,
  LayoutDashboardIcon,
  MailCheckIcon,
  ServerCogIcon,
  UsersIcon,
} from "lucide-react";

/**
 * The workspace's primary navigation. One definition, used by both the sidebar
 * and the small-screen drawer, so the two cannot list different destinations.
 *
 * `countKey` names the count an entry carries as a badge. It is a key rather
 * than a number because the counts are fetched in the layout and may be
 * missing — an entry whose key has no value renders no badge at all, which is
 * a different statement from a badge reading zero (design D8).
 */
export const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboardIcon },
  { name: "Leads", href: "/leads", icon: UsersIcon },
  { name: "Companies", href: "/companies", icon: BuildingIcon },
  {
    name: "Outreach Review",
    href: "/outreach/review",
    icon: MailCheckIcon,
    countKey: "outreachReview",
  },
  { name: "Analytics", href: "/analytics", icon: BarChart3Icon },
  { name: "Operations", href: "/operations", icon: ServerCogIcon },
] as const;

export type NavigationItem = (typeof navigation)[number];

/** The counts the navigation can show. */
export type NavigationCountKey = "outreachReview";

/**
 * A count that could not be read is absent from this record rather than zero.
 * Nothing here fills a gap with a plausible number.
 */
export type NavigationCounts = Partial<Record<NavigationCountKey, number>>;

/**
 * Above this a badge reads "99+". It lives here, with the navigation itself,
 * rather than beside the read that produces the counts: the sidebar and the
 * drawer are client components, and importing it from the read would drag
 * `next/headers` into the browser bundle.
 */
export const NAV_COUNT_CAP = 99;

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
