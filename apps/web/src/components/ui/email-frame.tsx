import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A drafted message shown the way it would be read: addressed, with a subject,
 * over a plain surface distinct from the workspace chrome around it.
 *
 * Children are rendered as given, so a body whose claims are wrapped in
 * `<Evidence>` keeps its citations. This component draws the envelope and
 * nothing else — it has no send control, and there is no send path in the
 * codebase for one to call.
 */
export function EmailFrame({
  to,
  from,
  subject,
  children,
  className,
}: {
  to: React.ReactNode;
  from?: React.ReactNode;
  subject: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      data-slot="email-frame"
      className={cn("rounded-lg border border-border bg-background p-5 text-body", className)}
    >
      <dl className="mb-4 flex flex-col gap-1 border-b border-border pb-4 text-meta text-muted-foreground">
        <div className="flex gap-2">
          <dt className="w-14 shrink-0">To</dt>
          <dd className="min-w-0 font-medium text-foreground">{to}</dd>
        </div>
        {from ? (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0">From</dt>
            <dd className="min-w-0 font-medium text-foreground">{from}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="w-14 shrink-0">Subject</dt>
          <dd className="min-w-0 font-medium text-foreground">{subject}</dd>
        </div>
      </dl>
      {/* 1.7 rather than the workspace's 1.5: this is prose to be read, not a
          dense table to be scanned. */}
      <div className="space-y-3.5 leading-7">{children}</div>
    </article>
  );
}
