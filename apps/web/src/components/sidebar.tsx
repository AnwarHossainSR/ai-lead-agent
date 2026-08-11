"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/" },
  { name: "Companies", href: "/companies" },
  { name: "Contacts", href: "/contacts" },
  { name: "Leads", href: "/leads" },
  { name: "Outreach", href: "/outreach" },
];

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
              pathname === item.href
                ? "bg-muted text-foreground"
                : "text-muted-foreground"
            )}
          >
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
