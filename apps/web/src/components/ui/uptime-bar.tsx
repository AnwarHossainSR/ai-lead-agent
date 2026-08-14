import { cn } from "@/lib/utils";

export interface UptimeSegment {
  /** The start of the period this segment covers, as an ISO 8601 timestamp. */
  readonly at: string;
  /**
   * What was sampled. `null` means nothing was recorded for this period —
   * before sampling began, or while the prober itself was down.
   */
  readonly status: "up" | "degraded" | "down" | null;
}

const SEGMENT_CLASS: Record<"up" | "degraded" | "down", string> = {
  up: "bg-success/80",
  degraded: "bg-warning/80",
  down: "bg-danger/80",
};

const SEGMENT_LABEL: Record<"up" | "degraded" | "down", string> = {
  up: "up",
  degraded: "degraded",
  down: "down",
};

/**
 * One segment per sampling period (design D6).
 *
 * The rule this component exists to enforce: an unrecorded period is drawn as
 * unrecorded — a hatched outline, not a colour — and never as healthy. An
 * uptime bar filled in across periods nobody sampled is the most persuasive
 * lie a status page can tell, and it is exactly what happens if `null` is
 * allowed to fall through to the default case.
 */
export function UptimeBar({
  segments,
  earliestSampleAt,
  label,
  className,
}: {
  segments: readonly UptimeSegment[];
  /**
   * The first sample actually held, as an ISO 8601 timestamp, or `null` when
   * there are none. Stated beneath the bar so the reader knows how far back
   * the record goes rather than assuming it covers the whole window.
   */
  earliestSampleAt: string | null;
  /** Which dependency this bar describes, for readers who cannot see it. */
  label: string;
  className?: string;
}) {
  if (segments.length === 0) {
    return (
      <p
        data-slot="uptime-empty"
        className={cn("text-label text-muted-foreground italic", className)}
      >
        No health samples recorded yet — this bar fills in as sampling runs.
      </p>
    );
  }

  const recorded = segments.filter((segment) => segment.status !== null).length;

  return (
    <div data-slot="uptime-bar" className={cn("flex flex-col gap-1.5", className)}>
      <div
        role="img"
        aria-label={`${label}: ${recorded} of ${segments.length} periods sampled`}
        className="flex gap-[3px]"
      >
        {segments.map((segment) => (
          <span
            key={segment.at}
            data-slot="uptime-segment"
            data-status={segment.status ?? "unrecorded"}
            title={
              segment.status === null
                ? `${segment.at}: not sampled`
                : `${segment.at}: ${SEGMENT_LABEL[segment.status]}`
            }
            className={cn(
              "h-4 flex-1 rounded-xs",
              segment.status === null
                ? // Hatched, not filled: nothing was measured here, and the
                  // pattern says so without a legend and without colour.
                  "border border-dashed border-border bg-[repeating-linear-gradient(45deg,var(--muted)_0_3px,transparent_3px_6px)]"
                : SEGMENT_CLASS[segment.status],
            )}
          />
        ))}
      </div>
      <p className="text-label text-muted-foreground">
        {earliestSampleAt === null ? (
          "No samples held for this window."
        ) : (
          <>
            Sampled from{" "}
            <time dateTime={earliestSampleAt}>
              {earliestSampleAt.slice(0, 16).replace("T", " ")} UTC
            </time>
            {recorded < segments.length
              ? ` · ${segments.length - recorded} period(s) not sampled`
              : null}
          </>
        )}
      </p>
    </div>
  );
}
