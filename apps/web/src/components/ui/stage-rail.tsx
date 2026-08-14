import {
  AlertTriangleIcon,
  CheckIcon,
  CircleDashedIcon,
  LoaderIcon,
  MinusIcon,
  XIcon,
} from "lucide-react";
import type * as React from "react";

import { type Tone, jobStateTone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

/**
 * Where one stage of the pipeline stands for one run or one company.
 *
 * `not_run` is deliberately outside the job-state vocabulary in
 * `status-tone.ts`: a stage that was never asked to do anything has no job to
 * have a state, and conflating it with `queued` would claim work is pending
 * that nobody scheduled.
 */
export type StageState =
  | "not_run"
  | "queued"
  | "running"
  | "succeeded"
  | "partial"
  | "failed"
  | "skipped";

export interface RailStage {
  readonly id: string;
  readonly label: string;
  readonly state: StageState;
  /** How many items cleared this stage. `null` when the stage never ran. */
  readonly completed: number | null;
  /** How many items the stage was given. `null` when that is not known. */
  readonly total: number | null;
  /** Why it failed, what it skipped, what it is waiting on. */
  readonly detail?: string;
}

const STATE_ICON: Record<StageState, React.ComponentType<{ className?: string }>> = {
  not_run: CircleDashedIcon,
  queued: MinusIcon,
  running: LoaderIcon,
  succeeded: CheckIcon,
  partial: AlertTriangleIcon,
  failed: XIcon,
  skipped: MinusIcon,
};

const STATE_LABEL: Record<StageState, string> = {
  not_run: "not run",
  queued: "queued",
  running: "running",
  succeeded: "succeeded",
  partial: "partly succeeded",
  failed: "failed",
  skipped: "skipped",
};

const MARK_TONE: Record<Tone, string> = {
  success: "border-success/40 bg-success-subtle text-success",
  warning: "border-warning/40 bg-warning-subtle text-warning",
  danger: "border-danger/40 bg-danger-subtle text-danger",
  info: "border-info/40 bg-info-subtle text-info",
  neutral: "border-border bg-muted text-muted-foreground",
};

const BAR_TONE: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-muted-foreground",
};

function toneOf(state: StageState): Tone {
  return state === "not_run" ? "neutral" : jobStateTone(state);
}

/**
 * The pipeline's nine stages as a vertical list, used by the run detail and
 * company detail screens.
 *
 * Every row states its state in words as well as by icon and tone, so nothing
 * here is carried by colour alone. A stage that never ran shows a dashed mark
 * and no progress bar — a bar at 0% would say it was asked and achieved
 * nothing.
 */
export function StageRail({
  stages,
  className,
}: {
  stages: readonly RailStage[];
  className?: string;
}) {
  return (
    <ol data-slot="stage-rail" className={cn("flex flex-col gap-3.5", className)}>
      {stages.map((stage) => (
        <StageRow key={stage.id} stage={stage} />
      ))}
    </ol>
  );
}

function StageRow({ stage }: { stage: RailStage }) {
  const tone = toneOf(stage.state);
  const Icon = STATE_ICON[stage.state];
  const notRun = stage.state === "not_run";
  const showBar = !notRun && stage.total !== null && stage.total > 0 && stage.completed !== null;
  const percent = showBar ? Math.min(100, ((stage.completed ?? 0) / (stage.total ?? 1)) * 100) : 0;

  return (
    <li
      data-slot="stage"
      data-state={stage.state}
      data-tone={tone}
      className="flex items-start gap-2.5"
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-px flex size-5 shrink-0 items-center justify-center rounded-full border",
          notRun && "border-dashed",
          MARK_TONE[tone],
        )}
      >
        <Icon className={cn("size-3", stage.state === "running" && "animate-spin")} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-meta font-medium">{stage.label}</span>
          <span data-numeric className="shrink-0 text-label text-muted-foreground">
            {notRun
              ? STATE_LABEL[stage.state]
              : stage.completed === null
                ? STATE_LABEL[stage.state]
                : stage.total === null
                  ? `${stage.completed.toLocaleString("en-US")} · ${STATE_LABEL[stage.state]}`
                  : `${stage.completed.toLocaleString("en-US")} of ${stage.total.toLocaleString("en-US")} · ${STATE_LABEL[stage.state]}`}
          </span>
        </div>

        {showBar ? (
          <span
            aria-hidden="true"
            className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted"
          >
            <span
              className={cn("block h-full rounded-full", BAR_TONE[tone])}
              style={{ width: `${percent}%` }}
            />
          </span>
        ) : null}

        {stage.detail ? (
          <p className="mt-1 text-label text-muted-foreground">{stage.detail}</p>
        ) : null}
      </div>
    </li>
  );
}
