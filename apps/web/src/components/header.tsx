import Link from "next/link";

import { signOutAction } from "@/app/(workspace)/actions";
import { MobileNav } from "@/components/mobile-nav";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { CurrentAccount } from "@/lib/session";
import type { ThemePreference } from "@/lib/theme";

/** The signed-in account and a sign-out control (task 8.3, dashboard spec: "the signed-in account is visible"). */
export function Header({
  account,
  theme = "system",
}: {
  account: CurrentAccount;
  theme?: ThemePreference;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-14 items-center gap-2 px-4">
        <MobileNav />
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="text-lg tracking-tight">MELA</span>
        </Link>
        <nav aria-label="Account" className="ml-auto flex items-center gap-2">
          <Link
            href="/api-status"
            className="hidden rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors duration-(--duration-fast) outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:inline-flex"
          >
            API Status
          </Link>
          <ThemeToggle preference={theme} />
          <Separator orientation="vertical" className="hidden h-5 sm:block" />
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {account.email} · {account.role}
          </span>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </nav>
      </div>
    </header>
  );
}
