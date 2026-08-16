import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Every page opens the same way: an optional eyebrow saying which part of the
 * workspace this is, the page's single `h1`, a sentence saying what the page is
 * for, and the page-level actions.
 *
 * Keeping it in one component is what keeps the heading order correct
 * (spec: accessibility floor) and what makes a page built later match without
 * its author being told how. Sizes come from the density scale — nothing here
 * sets a font size of its own.
 *
 * The breadcrumb lives in the top bar, which renders on every route and can
 * derive it from the path; a page does not restate where it is.
 */
function PageHeader({
  className,
  eyebrow,
  title,
  description,
  actions,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      data-slot="page-header"
      className={cn("mb-7 flex flex-col items-start gap-4 sm:flex-row sm:items-end", className)}
      {...props}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p
            data-slot="page-header-eyebrow"
            className="mb-1 text-label font-bold tracking-eyebrow text-primary uppercase"
          >
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-balance">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-prose text-meta text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div data-slot="page-header-actions" className="flex shrink-0 items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export { PageHeader };
