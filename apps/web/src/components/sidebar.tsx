"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { setSidebarCollapsedAction } from "@/app/theme-actions";
import { isActive, navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Primary navigation on `md` and up (design D10). Below that it is absent by
 * design and the drawer in `mobile-nav.tsx` takes over — the two share one
 * navigation definition.
 *
 * The collapsed state arrives from the server as `defaultCollapsed`, read from
 * a cookie, so the sidebar renders in the right width on the first paint rather
 * than expanding and snapping shut.
 */
export function Sidebar({ defaultCollapsed = false }: { defaultCollapsed?: boolean }) {
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
      className={cn(
        "hidden shrink-0 border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-(--duration-base) md:block",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <nav aria-label="Primary" className="flex flex-col gap-1 p-2">
        {navigation.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.name : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-(--duration-fast) outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
                // The active route carries a left rail as well as its fill, so
                // the current page is not identified by colour alone.
                active
                  ? "border-l-2 border-sidebar-primary bg-sidebar-accent pl-2 text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className={cn(collapsed && "sr-only")}>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className={cn("flex p-2", collapsed ? "justify-center" : "justify-end")}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={toggle}
        >
          {collapsed ? (
            <PanelLeftOpenIcon aria-hidden="true" />
          ) : (
            <PanelLeftCloseIcon aria-hidden="true" />
          )}
        </Button>
      </div>
    </aside>
  );
}
