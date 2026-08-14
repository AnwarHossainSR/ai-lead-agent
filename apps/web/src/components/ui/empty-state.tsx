import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * "Nothing yet" and "nothing matches these filters" are different facts about
 * the data, and conflating them is how a reader concludes a list is empty when
 * a filter is hiding it. `variant` picks which one is being stated; the
 * filtered case takes an action that clears the filters (spec: empty state).
 */
function EmptyState({
  className,
  variant = "empty",
  icon,
  title,
  description,
  action,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  variant?: "empty" | "filtered";
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="empty-state"
      data-variant={variant}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg:not([class*='size-'])]:size-4"
        >
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
