import Link from "next/link";

import { formatAge } from "@/lib/format-age";
import type { Tone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

export interface ActivityEntry {
  readonly id: string;
  /**
   * Who did this. `null` for something the platform did on its own — a
   * scheduled probe, a stage advancing, a job retrying. An unattributed event
   * is shown as unattributed; it never borrows the name of whoever happens to
   * be reading the page.
   */
  readonly actor: string | null;
  /** What happened, in plain words: "approved a draft", "analysis failed". */
  readonly action: string;
  /** What it happened to — a company, a lead, a run. */
  readonly subject?: string;
  /** Where the reader goes to see it. */
  readonly href?: string;
  /** When, as an ISO 8601 timestamp. */
  readonly at: string;
  readonly tone: Tone;
}

const DOT_TONE: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

/**
 * Recent workspace events, drawn from what was actually recorded.
 *
 * The tone dot is decoration: every entry states its action in words, so the
 * feed reads the same in greyscale. A system event says "System" rather than
 * leaving the actor column blank, because a blank reads as a rendering bug.
 */
export function ActivityFeed({
  entries,
  now,
  className,
}: {
  entries: readonly ActivityEntry[];
  /** Pinned by the caller so server and client agree on "2h ago". */
  now?: Date;
  className?: string;
}) {
  return (
    <ul data-slot="activity-feed" className={cn("flex flex-col", className)}>
      {entries.map((entry) => (
        <li
          key={entry.id}
          data-slot="activity"
          data-tone={entry.tone}
          className="flex items-start gap-2.5 border-b border-border px-4 py-3 last:border-0"
        >
          <span
            aria-hidden="true"
            className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", DOT_TONE[entry.tone])}
          />
          <div className="min-w-0 flex-1">
            <p className="text-meta">
              {entry.href && entry.subject ? (
                <Link
                  href={entry.href}
                  className="font-medium underline-offset-4 transition-colors duration-(--duration-fast) hover:underline focus-visible:rounded-xs focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {entry.subject}
                </Link>
              ) : entry.subject ? (
                <span className="font-medium">{entry.subject}</span>
              ) : null}
              {entry.subject ? " — " : null}
              {entry.action}
            </p>
            <p className="mt-0.5 text-label text-muted-foreground">
              {entry.actor === null ? (
                <span data-slot="activity-actor" data-actor="system">
                  System
                </span>
              ) : (
                <span data-slot="activity-actor">{entry.actor}</span>
              )}
              {" · "}
              <time dateTime={entry.at}>{formatAge(entry.at, now)}</time>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
