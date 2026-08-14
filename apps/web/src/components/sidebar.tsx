"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: "Dashboard", href: "/" },
  { name: "Leads", href: "/leads" },
  { name: "Companies", href: "/companies" },
  { name: "Outreach Review", href: "/outreach/review" },
  { name: "Analytics", href: "/analytics" },
  { name: "Operations", href: "/operations" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border md:block">
      <nav className="flex flex-col gap-1 p-4">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
              isActive(pathname, item.href) ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
