import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * How well established a value is. Mirrors the database's `certainty`
 * column ("observed" | "inferred") plus a third state, "unknown", for a
 * fact the platform never established at all — never a blank, a dash or a
 * zero standing in for "we don't know".
 */
export type Certainty = "observed" | "inferred";

export type FactValue<T> =
  | { certainty: "observed"; value: T }
  | { certainty: "inferred"; value: T; inferredFrom?: string }
  | { certainty: "unknown" };

interface FactProps<T> {
  fact: FactValue<T>;
  format?: (value: T) => ReactNode;
  className?: string;
}

/**
 * Renders a single claim in one of three visually distinct states. There is
 * no code path here that can turn a missing value into "", "—" or 0 — the
 * unknown branch always renders the word "unknown".
 */
export function Fact<T>({ fact, format, className }: FactProps<T>) {
  if (fact.certainty === "unknown") {
    return (
      <span
        data-slot="fact"
        data-certainty="unknown"
        className={cn("text-muted-foreground italic", className)}
      >
        unknown
      </span>
    );
  }

  const rendered = format ? format(fact.value) : String(fact.value);

  if (fact.certainty === "inferred") {
    const reason = fact.inferredFrom
      ? `Inferred from ${fact.inferredFrom}`
      : "Inferred, not directly observed";

    return (
      <button
        type="button"
        data-slot="fact"
        data-certainty="inferred"
        title={reason}
        aria-label={`${String(rendered)} (${reason})`}
        className={cn(
          "cursor-help border-0 bg-transparent p-0 font-inherit underline decoration-muted-foreground decoration-dotted underline-offset-4",
          className,
        )}
      >
        {rendered}
      </button>
    );
  }

  return (
    <span data-slot="fact" data-certainty="observed" className={className}>
      {rendered}
    </span>
  );
}
