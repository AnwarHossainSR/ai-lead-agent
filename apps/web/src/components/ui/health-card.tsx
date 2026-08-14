import { ServerIcon } from "lucide-react";
import type * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UptimeBar, type UptimeSegment } from "@/components/ui/uptime-bar";
import { healthTone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

/**
 * One dependency's current state, and optionally the record behind it.
 *
 * The badge names the status in words; the tone is a second carrier of the
 * same fact, never the only one. `detail` is what the check actually returned
 * — a latency, an error, "not checked" — and is required, because a card
 * saying only "degraded" leaves the reader with the one question it was
 * supposed to answer.
 */
export function HealthCard({
  name,
  status,
  detail,
  icon,
  uptime,
  className,
}: {
  name: string;
  /** A value from the health vocabulary in `status-tone.ts`. */
  status: string;
  detail: React.ReactNode;
  icon?: React.ReactNode;
  uptime?: {
    readonly segments: readonly UptimeSegment[];
    readonly earliestSampleAt: string | null;
  };
  className?: string;
}) {
  const tone = healthTone(status);

  return (
    <Card
      data-slot="health-card"
      rail={status === "healthy" || status === "up" ? "observed" : "unknown"}
      tone={tone}
      className={cn("gap-3 p-4", className)}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg:not([class*='size-'])]:size-4"
        >
          {icon ?? <ServerIcon />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-meta font-semibold">{name}</h2>
          <p className="mt-0.5 text-meta text-muted-foreground">{detail}</p>
        </div>
        <Badge tone={tone}>{status}</Badge>
      </div>

      {uptime ? (
        <UptimeBar
          segments={uptime.segments}
          earliestSampleAt={uptime.earliestSampleAt}
          label={name}
        />
      ) : null}
    </Card>
  );
}
