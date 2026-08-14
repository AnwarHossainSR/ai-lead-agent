import { BellIcon } from "lucide-react";
import Link from "next/link";

import { signOutAction } from "@/app/(workspace)/actions";
import { MobileNav } from "@/components/mobile-nav";
import type { NavigationCounts } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { WorkspaceBreadcrumb } from "@/components/workspace-breadcrumb";
import { WorkspaceSearch } from "@/components/workspace-search";
import type { CurrentAccount } from "@/lib/session";
import type { ThemePreference } from "@/lib/theme";

/**
 * The top bar: where you are on the left, what you can reach on the right.
 *
 * The account's role is rendered as text rather than hidden behind a menu
 * (spec: the role is legible) — what an operator may do and what a viewer may
 * do differ throughout the workspace, and needing to open something to find
 * out which one you are is the wrong shape for that.
 */
export function Header({
  account,
  theme = "system",
  counts = {},
}: {
  account: CurrentAccount;
  theme?: ThemePreference;
  /** Counts read in the layout; an absent key renders no badge (design D8). */
  counts?: NavigationCounts;
}) {
  const awaiting = counts.outreachReview;

  return (
    <header className="sticky top-0 z-40 h-(--size-topbar) shrink-0 border-b border-border bg-surface-topbar/95 backdrop-blur supports-[backdrop-filter]:bg-surface-topbar/70">
      <div className="flex h-full items-center gap-3 px-3.5 md:px-8">
        <MobileNav counts={counts} />
        <WorkspaceBreadcrumb />

        <div className="ml-auto flex items-center gap-2.5">
          <WorkspaceSearch />

          <Link
            href="/companies/needs-attention"
            className="relative grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <BellIcon className="size-4" aria-hidden="true" />
            <span className="sr-only">
              {awaiting === undefined
                ? "Work needing attention"
                : `Work needing attention — ${awaiting} draft(s) awaiting review`}
            </span>
            {/* No badge when the count could not be read: a bell with no dot
                says "nothing is known", a bell showing 0 says "nothing is
                waiting", and only one of those is true here (design D8). */}
            {awaiting === undefined || awaiting === 0 ? null : (
              <span
                aria-hidden="true"
                className="absolute top-0 right-0 grid size-4 place-items-center rounded-full border-2 border-surface-topbar bg-danger text-label font-bold text-danger-foreground"
              >
                {awaiting > 9 ? "9+" : awaiting}
              </span>
            )}
          </Link>

          <ThemeToggle preference={theme} />

          <span className="hidden text-meta text-muted-foreground lg:inline">
            {account.email} · <span className="capitalize">{account.role}</span>
          </span>

          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
