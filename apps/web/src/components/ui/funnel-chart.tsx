import { cn } from "@/lib/utils";

export interface FunnelStage {
  readonly id: string;
  readonly label: string;
  /**
   * How many companies reached this stage. `null` means the stage has never
   * run — which is a different fact from having run and found nothing, and the
   * two render differently below.
   */
  readonly count: number | null;
}

/**
 * Companies by furthest stage reached, one labelled row per stage.
 *
 * The distinction the whole product rests on shows up here as two different
 * rows: a stage that ran and counted nothing gets a solid, empty track and the
 * figure `0`; a stage that never ran gets a dashed track and the words "not
 * run". Neither is allowed to look like the other, and there is no code path
 * that renders `null` as a zero.
 */
export function FunnelChart({
  stages,
  className,
}: {
  stages: readonly FunnelStage[];
  className?: string;
}) {
  // Proportions are against the largest recorded count, so the widest bar is
  // full width and every other is honestly relative to it. Stages that never
  // ran contribute nothing to the scale.
  const recorded = stages.filter((stage) => stage.count !== null).map((stage) => stage.count ?? 0);
  const max = recorded.length > 0 ? Math.max(...recorded) : 0;

  return (
    <ul data-slot="funnel-chart" className={cn("flex flex-col gap-3", className)}>
      {stages.map((stage) => (
        <FunnelRow key={stage.id} stage={stage} max={max} />
      ))}
    </ul>
  );
}

function FunnelRow({ stage, max }: { stage: FunnelStage; max: number }) {
  const notRun = stage.count === null;
  const width = notRun || max === 0 ? 0 : ((stage.count ?? 0) / max) * 100;

  return (
    <li
      data-slot="funnel-row"
      data-state={notRun ? "not-run" : "recorded"}
      className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-meta text-muted-foreground sm:grid-cols-[9rem_1fr_auto]"
    >
      <span className="truncate">{stage.label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "h-2 overflow-hidden rounded-full",
          // A dashed outline over the canvas, not a filled track: an unrun
          // stage has no bar to be empty.
          notRun ? "border border-dashed border-border" : "bg-muted",
        )}
      >
        {notRun ? null : (
          <span
            className="block h-full rounded-full bg-primary/80"
            style={{ width: `${width}%` }}
          />
        )}
      </span>
      {notRun ? (
        <span className="text-label whitespace-nowrap text-muted-foreground italic">not run</span>
      ) : (
        <span data-numeric className="min-w-8 text-right text-meta font-medium text-foreground">
          {(stage.count ?? 0).toLocaleString("en-US")}
        </span>
      )}
    </li>
  );
}
