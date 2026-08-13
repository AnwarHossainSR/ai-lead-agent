import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">MELA</span>
        </Link>
        <nav className="ml-auto flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Middle East Lead Agent</span>
          <Link
            href="/api-status"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            API Status
          </Link>
        </nav>
      </div>
    </header>
  );
}
