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
 */
export const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboardIcon },
  { name: "Leads", href: "/leads", icon: UsersIcon },
  { name: "Companies", href: "/companies", icon: BuildingIcon },
  { name: "Outreach Review", href: "/outreach/review", icon: MailCheckIcon },
  { name: "Analytics", href: "/analytics", icon: BarChart3Icon },
  { name: "Operations", href: "/operations", icon: ServerCogIcon },
] as const;

export type NavigationItem = (typeof navigation)[number];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
