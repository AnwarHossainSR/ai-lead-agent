"use client";

import type { ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EvidenceProps {
  /** The source URL a claim was recorded from. */
  sourceUrl: string;
  /** When the claim was recorded, as an ISO 8601 string or a Date. */
  recordedAt: string | Date;
  /** The matched or cited text supporting the claim. */
  detail: string;
  /** The trigger content — usually the fact this evidence backs. */
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a claim's source URL, recorded time and matched/cited text in a
 * popover, so a page of facts doesn't become a wall of citations.
 */
export function Evidence({ sourceUrl, recordedAt, detail, children, className }: EvidenceProps) {
  const recordedDate = typeof recordedAt === "string" ? new Date(recordedAt) : recordedAt;

  return (
    <Popover>
      <PopoverTrigger
        data-slot="evidence-trigger"
        className={cn(
          "cursor-help border-0 bg-transparent p-0 font-inherit underline decoration-muted-foreground decoration-dotted underline-offset-4",
          className,
        )}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Evidence</PopoverTitle>
        </PopoverHeader>
        <p className="text-sm">{detail}</p>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate text-primary underline underline-offset-4"
          >
            {sourceUrl}
          </a>
          <time dateTime={recordedDate.toISOString()}>
            Recorded {formatRecordedAt(recordedDate)}
          </time>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * A fixed, timezone-independent format so server and client render the
 * same string regardless of either one's locale.
 */
function formatRecordedAt(date: Date): string {
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}
