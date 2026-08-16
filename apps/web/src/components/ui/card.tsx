import type * as React from "react";

import type { Tone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

/**
 * The surface every panel, stat and detail block sits on.
 *
 * `rail` draws the certainty rail (see `globals.css`): the left edge states how
 * well established what the card shows is — solid observed, dotted inferred,
 * dashed unknown — and `tone` colours it. A card with no claim to make takes
 * neither and renders as a plain surface.
 */
function Card({
  className,
  rail,
  tone,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & {
  rail?: "observed" | "inferred" | "unknown";
  tone?: Tone | "primary";
  interactive?: boolean;
}) {
  return (
    <div
      data-slot="card"
      data-rail={rail}
      data-tone={tone}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xs transition-[box-shadow,transform,border-color] duration-(--duration-base)",
        // A hairline of light along the top edge is what makes the surface read
        // as lit rather than as a rectangle with a border.
        "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-[var(--elevation-highlight)]",
        rail && "pl-1",
        interactive &&
          "hover:-translate-y-px hover:border-ring/40 hover:shadow-md focus-within:border-ring/60 focus-within:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-wrap items-start justify-between gap-2 px-4.5 pt-4.5 pb-3",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3 data-slot="card-title" className={cn("text-heading font-semibold", className)} {...props} />
  );
}

/** The small uppercase line above a title — what this card is, in two words. */
function CardEyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-eyebrow"
      className={cn(
        "text-label font-semibold tracking-eyebrow text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-meta text-muted-foreground", className)}
      {...props}
    />
  );
}

/** The header's right-hand slot — an action, a badge, a menu. */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("ml-auto flex items-center gap-2", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-4.5 pb-4.5", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "mt-auto flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-4.5 py-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardHeader,
  CardTitle,
};
