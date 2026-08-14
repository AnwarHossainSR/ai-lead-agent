"use client";

import { AlertTriangleIcon, PlugZapIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { FetchResult } from "@/lib/fetch-with-timeout";
import { cn } from "@/lib/utils";

/**
 * How an unavailable panel presents itself (spec: error and degraded state).
 *
 * `degraded` and `unreachable` are different facts and are shown differently:
 * a degraded source answered and refused, so the data may be recoverable and
 * the tone is a warning; an unreachable one said nothing at all, which is a
 * failure. Conflating them costs an operator the first useful thing they would
 * otherwise know.
 */
export function Unavailable({
  title,
  status,
  error,
  className,
}: {
  title: string;
  status: "degraded" | "unreachable";
  error: string;
  className?: string;
}) {
  const degraded = status === "degraded";
  const Icon = degraded ? AlertTriangleIcon : PlugZapIcon;

  return (
    <div
      role="alert"
      data-slot="unavailable"
      data-rail="unknown"
      data-tone={degraded ? "warning" : "danger"}
      data-status={status}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 pl-5",
        degraded ? "border-warning/30 bg-warning-subtle/40" : "border-danger/30 bg-danger-subtle/40",
        className,
      )}
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", degraded ? "text-warning" : "text-danger")}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", degraded ? "text-warning" : "text-danger")}>
          {degraded ? `${title} answered with an error` : `${title} is unreachable`}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {degraded
            ? "The source responded, so what is shown elsewhere on this page is current."
            : "Nothing was returned, so this panel has no data to show — not zero."}
        </p>
        <RetryButton className="mt-3" />
      </div>
    </div>
  );
}

/** Re-runs the server render for the current route. */
export function RetryButton({ className, label = "Try again" }: { className?: string; label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      pending={isPending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {!isPending && <RefreshCwIcon aria-hidden="true" />}
      {isPending ? "Retrying…" : label}
    </Button>
  );
}

/**
 * Narrows a `FetchResult` for a panel: either the data, or the designed state
 * saying which way it failed. Callers keep their own `result.status === "ok"`
 * branch — this only replaces the hand-rolled failure markup.
 */
export function unavailableFrom<T>(
  title: string,
  result: FetchResult<T>,
): React.ReactNode | null {
  if (result.status === "ok") return null;
  return <Unavailable title={title} status={result.status} error={result.error} />;
}
