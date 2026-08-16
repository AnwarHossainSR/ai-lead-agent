"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import { breadcrumbFor } from "@/lib/breadcrumb";

/** Where the reader is, derived from the path — see `lib/breadcrumb.ts`. */
export function WorkspaceBreadcrumb() {
  const pathname = usePathname();
  const crumbs = breadcrumbFor(pathname);

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 sm:block">
      <ol className="flex items-center gap-1.5 text-meta text-muted-foreground">
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.href ?? `${crumb.label}-${index}`}>
            {index > 0 ? (
              <ChevronRightIcon className="size-3 shrink-0 text-border" aria-hidden="true" />
            ) : null}
            <li className="min-w-0">
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate rounded-xs transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate font-semibold text-foreground">
                  {crumb.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
