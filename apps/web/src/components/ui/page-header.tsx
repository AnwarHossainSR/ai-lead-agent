import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Every page opens the same way: an optional breadcrumb, the page's single
 * `h1`, a sentence saying what the page is for, and the page-level actions.
 * Keeping it in one component is what keeps the heading order correct
 * (spec: accessibility floor).
 */
function PageHeader({
  className,
  title,
  description,
  breadcrumb,
  actions,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div data-slot="page-header" className={cn("flex flex-col gap-2", className)} {...props}>
      {breadcrumb ? <div data-slot="page-header-breadcrumb">{breadcrumb}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          {/* Size and tracking come from the scale in `globals.css`; a page
              title that set its own would be the first of 200 near-misses. */}
          <h1 className="font-bold text-balance">{title}</h1>
          {description ? (
            <p className="max-w-prose text-meta text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div data-slot="page-header-actions" className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A trail of links to where the current page sits. */
function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="breadcrumb"
      aria-label="Breadcrumb"
      className={cn("text-meta text-muted-foreground", className)}
      {...props}
    />
  );
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn(
        "flex items-center gap-1.5 after:text-border after:content-['/'] last:after:content-none",
        className,
      )}
      {...props}
    />
  );
}

export { Breadcrumb, BreadcrumbItem, BreadcrumbList, PageHeader };
