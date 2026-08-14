import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import type { Tone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-label font-semibold whitespace-nowrap [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      tone: {
        success: "border-success/30 bg-success-subtle text-success",
        warning: "border-warning/30 bg-warning-subtle text-warning",
        danger: "border-danger/30 bg-danger-subtle text-danger",
        info: "border-info/30 bg-info-subtle text-info",
        neutral: "border-border bg-muted text-muted-foreground",
      },
      emphasis: {
        subtle: "",
        solid: "border-transparent",
      },
    },
    compoundVariants: [
      { tone: "success", emphasis: "solid", className: "bg-success text-success-foreground" },
      { tone: "warning", emphasis: "solid", className: "bg-warning text-warning-foreground" },
      { tone: "danger", emphasis: "solid", className: "bg-danger text-danger-foreground" },
      { tone: "info", emphasis: "solid", className: "bg-info text-info-foreground" },
      { tone: "neutral", emphasis: "solid", className: "bg-foreground/80 text-background" },
    ],
    defaultVariants: {
      tone: "neutral",
      emphasis: "subtle",
    },
  },
);

/**
 * A status marker. It takes a `tone` from `status-tone.ts` — never a colour —
 * so the same meaning renders the same way everywhere, and it always renders
 * its label as text, so the colour is never the only thing carrying the
 * meaning (spec: status is not carried by colour alone).
 */
function Badge({
  className,
  tone = "neutral",
  emphasis = "subtle",
  children,
  ...props
}: React.ComponentProps<"span"> &
  Omit<VariantProps<typeof badgeVariants>, "tone"> & { tone?: Tone }) {
  return (
    <span
      data-slot="badge"
      data-tone={tone}
      className={cn(badgeVariants({ tone, emphasis, className }))}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
