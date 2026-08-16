"use client";

import { ActivityIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { setSidebarCollapsedAction } from "@/app/theme-actions";
import {
  NAV_COUNT_CAP,
  type NavigationCounts,
  isActive,
  navigation,
} from "@/components/navigation";
import { Button } from "@/components/ui/button";
import type { CurrentAccount } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * Primary navigation on `md` and up (design D10). Below that it is absent by
 * design and the drawer in `mobile-nav.tsx` takes over — the two share one
 * navigation definition.
 *
 * The collapsed state arrives from the server as `defaultCollapsed`, read from
 * a cookie, so the sidebar renders in the right width on the first paint rather
 * than expanding and snapping shut.
 *
 * Collapsed, every label becomes an icon with its name still in the accessible
 * tree and in a tooltip — the rail loses the words, not the destinations.
 */
export function Sidebar({
  account,
  counts = {},
  defaultCollapsed = false,
}: {
  account: CurrentAccount;
  /** Counts read in the layout. A key absent here renders no badge. */
  counts?: NavigationCounts;
  defaultCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    startTransition(async () => {
      await setSidebarCollapsedAction(next);
    });
  }

  return (
    <aside
      data-slot="sidebar"
      data-collapsed={collapsed || undefined}
      style={{ width: collapsed ? "var(--size-sidebar-collapsed)" : "var(--size-sidebar)" }}
      className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-surface-sidebar px-3 py-4 text-sidebar-foreground transition-[width] duration-(--duration-base) md:flex"
    >
      <div className={cn("flex items-center gap-2.5 px-2", collapsed && "justify-center px-0")}>
        <Link
          href="/"
          aria-label="MELA — dashboard"
          className="flex items-center gap-2.5 rounded-md font-heading font-bold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50"
        >
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-heading text-primary-foreground"
          >
            M
          </span>
          {collapsed ? null : <span className="text-lg">MELA</span>}
        </Link>
        {collapsed ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="ml-auto"
            aria-expanded={true}
            aria-label="Collapse navigation"
            onClick={toggle}
          >
            <PanelLeftCloseIcon aria-hidden="true" />
          </Button>
        )}
      </div>

      <AccountBlock account={account} collapsed={collapsed} />

      <nav aria-label="Primary" className="flex flex-col gap-0.5">
        {navigation.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const count = "countKey" in item ? counts[item.countKey] : undefined;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.name : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-meta font-medium transition-colors duration-(--duration-fast) outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
                // The active route carries a left rail as well as its fill, so
                // the current page is not identified by colour alone.
                active
                  ? "border-l-2 border-sidebar-primary bg-sidebar-accent pl-2 font-semibold text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className={cn(collapsed && "sr-only")}>{item.name}</span>
              {/* Absent, not zero: `counts` omits a key whose read failed
                  (design D8), and a badge reading 0 would say the queue is
                  empty when nobody actually knows. */}
              {count === undefined ? null : (
                <span
                  data-slot="nav-count"
                  className={cn(
                    "ml-auto rounded-full bg-primary px-1.5 py-px text-label font-semibold text-primary-foreground",
                    collapsed && "sr-only",
                  )}
                >
                  {count > NAV_COUNT_CAP ? `${NAV_COUNT_CAP}+` : count}
                  <span className="sr-only"> awaiting review</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-border pt-2.5">
        <Link
          href="/api-status"
          aria-current={isActive(pathname, "/api-status") ? "page" : undefined}
          title={collapsed ? "API Status" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-meta text-muted-foreground transition-colors duration-(--duration-fast) outline-none hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
            collapsed && "justify-center px-0",
          )}
        >
          <ActivityIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className={cn(collapsed && "sr-only")}>API Status</span>
        </Link>

        {collapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="self-center"
            aria-expanded={false}
            aria-label="Expand navigation"
            onClick={toggle}
          >
            <PanelLeftOpenIcon aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </aside>
  );
}

/** Who is signed in, and as what — legible without opening anything. */
function AccountBlock({
  account,
  collapsed,
}: {
  account: CurrentAccount;
  collapsed: boolean;
}) {
  const initials = account.email.slice(0, 2).toUpperCase();

  return (
    <div
      data-slot="sidebar-account"
      className={cn(
        "flex items-center gap-2.5 rounded-md border border-border bg-card p-2.5",
        collapsed && "justify-center border-0 bg-transparent p-0",
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-sm bg-accent text-label font-bold text-accent-foreground"
      >
        {initials}
      </span>
      {collapsed ? (
        <span className="sr-only">
          Signed in as {account.email}, role {account.role}
        </span>
      ) : (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-meta font-semibold">{account.email}</span>
          <span className="truncate text-label text-muted-foreground capitalize">
            {account.role}
          </span>
        </span>
      )}
    </div>
  );
}
