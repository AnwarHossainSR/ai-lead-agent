import Link from "next/link";

import { signOutAction } from "@/app/(workspace)/actions";
import { Button } from "@/components/ui/button";
import type { CurrentAccount } from "@/lib/session";

/** The signed-in account and a sign-out control (task 8.3, dashboard spec: "the signed-in account is visible"). */
export function Header({ account }: { account: CurrentAccount }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">MELA</span>
        </Link>
        <nav className="ml-auto flex items-center gap-4">
          <Link
            href="/api-status"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            API Status
          </Link>
          <span className="text-sm text-muted-foreground">
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
