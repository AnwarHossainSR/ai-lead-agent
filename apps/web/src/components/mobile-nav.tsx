"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { isActive, navigation } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Navigation on a small screen (spec: navigation on a small screen).
 *
 * The sidebar is `hidden … md:block`, so without this a phone has no navigation
 * at all. Built on Base UI's dialog, which traps focus while the drawer is open,
 * closes on `Escape` and returns focus to the control that opened it; the route
 * change below closes it too, so following a link does not leave it open over
 * the page that just loaded.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A route change closes the drawer, so a followed link does not leave it open
  // over the page that just loaded.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the pathname is the trigger, not a value the effect reads.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" className="md:hidden">
            <MenuIcon aria-hidden="true" />
            <span className="sr-only">Open navigation</span>
          </Button>
        }
      />
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-foreground/40 duration-(--duration-base) data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 md:hidden" />
        <DialogPrimitive.Popup
          data-slot="mobile-nav"
          className="fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80vw] flex-col gap-2 border-r border-border bg-sidebar p-3 text-sidebar-foreground shadow-lg outline-none duration-(--duration-base) data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left md:hidden"
        >
          <div className="flex items-center justify-between">
            <DialogPrimitive.Title className="text-sm font-semibold">
              Navigation
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              render={
                <Button type="button" variant="ghost" size="icon-sm">
                  <XIcon aria-hidden="true" />
                  <span className="sr-only">Close navigation</span>
                </Button>
              }
            />
          </div>

          <nav aria-label="Primary" className="flex flex-col gap-1">
            {navigation.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-(--duration-fast) outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
                    active
                      ? "border-l-2 border-sidebar-primary bg-sidebar-accent pl-2 text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
