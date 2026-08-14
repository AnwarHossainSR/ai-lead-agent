"use client";

/*
 * Design D5, branch A: the installed `@base-ui/react` 1.7.0 *does* export a
 * `Toast` primitive (`@base-ui/react/toast` — Provider, Portal, Viewport, Root,
 * Title, Description, Close, `useToastManager`), so the in-house fallback
 * provider described in D5 is not built. No new dependency is added.
 *
 * What Base UI supplies: the queue and its limit, per-toast dismiss timers that
 * pause on hover and focus, swipe-to-dismiss, and the live regions — the
 * viewport is `role="region"` / `aria-live="polite"`, and a toast added with
 * `priority: "high"` is additionally mirrored into a visually hidden
 * `role="alert"` region, which is where an error lands. Focus is never moved to
 * the viewport; it is reachable by keyboard but not stolen.
 *
 * What this file adds: theme styling, the three tones the product uses, and a
 * `useToast()` surface narrow enough that a caller cannot accidentally raise an
 * error politely.
 */

import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { FLASH_TOAST_COOKIE, type FlashToast } from "@/lib/flash-toast";
import { cn } from "@/lib/utils";

/** How the outcome of an action is presented. */
export type ToastTone = "success" | "error" | "info";

/** At most this many toasts are on screen; older ones drop off the stack. */
const TOAST_LIMIT = 3;

/** Long enough to read a sentence, short enough not to sit in the way. */
const TOAST_TIMEOUT_MS = 6000;

const toneStyles: Record<ToastTone, string> = {
  success: "border-success/30 bg-success-subtle text-success",
  error: "border-danger/30 bg-danger-subtle text-danger",
  info: "border-info/30 bg-info-subtle text-info",
};

const toneIcons: Record<ToastTone, typeof CheckCircle2Icon> = {
  success: CheckCircle2Icon,
  error: AlertTriangleIcon,
  info: InfoIcon,
};

/**
 * The toast surface: mounted once per layout, rendered into a portal so it is
 * not clipped by any page container.
 */
function ToastProvider({
  children,
  initialToast,
  limit = TOAST_LIMIT,
  timeout = TOAST_TIMEOUT_MS,
}: {
  children: React.ReactNode;
  initialToast?: FlashToast | null;
  limit?: number;
  timeout?: number;
}) {
  return (
    <ToastPrimitive.Provider limit={limit} timeout={timeout}>
      {children}
      <FlashToastOnMount toast={initialToast} />
      <ToastPrimitive.Portal>
        <ToastViewport />
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  );
}

/**
 * A toast carried across a redirect by the flash cookie. It is raised once —
 * a second render must not re-announce it — and the cookie is expired here,
 * because a layout renders on the server and cannot write cookies.
 */
function FlashToastOnMount({ toast }: { toast?: FlashToast | null }) {
  const { add } = ToastPrimitive.useToastManager();
  const raised = useRef(false);

  useEffect(() => {
    if (!toast || raised.current) return;
    raised.current = true;

    add(toastOptions(toast.tone, toast.message));
    document.cookie = `${FLASH_TOAST_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }, [toast, add]);

  return null;
}

function toastOptions(tone: ToastTone, message: string) {
  return {
    title: message,
    type: tone,
    // `high` is what puts an error into the assertive region; a success or an
    // informational message is announced politely so it does not interrupt.
    priority: tone === "error" ? ("high" as const) : ("low" as const),
  };
}

function ToastViewport() {
  const { toasts } = ToastPrimitive.useToastManager();

  return (
    <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-100 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none">
      {toasts
        // A toast past the limit is marked `limited` rather than removed, so it
        // is dropped here — the stack stays bounded and the oldest goes first.
        .filter((toast) => !toast.limited)
        .map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
    </ToastPrimitive.Viewport>
  );
}

function ToastItem({ toast }: { toast: ToastPrimitive.Root.ToastObject }) {
  const tone = (toast.type ?? "info") as ToastTone;
  const Icon = toneIcons[tone] ?? InfoIcon;

  return (
    <ToastPrimitive.Root
      toast={toast}
      data-tone={tone}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border bg-card p-3 shadow-md duration-(--duration-base) data-ending-style:opacity-0 data-starting-style:opacity-0",
        toneStyles[tone] ?? toneStyles.info,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <ToastPrimitive.Title className="text-sm font-medium text-foreground" />
        <ToastPrimitive.Description className="text-sm text-muted-foreground" />
      </div>
      <ToastPrimitive.Close
        aria-label="Dismiss notification"
        className="rounded-md p-0.5 text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <XIcon className="size-4" aria-hidden="true" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

/**
 * Raises a toast. `error` is announced assertively and the other two politely,
 * which is decided here rather than at each call site.
 */
function useToast() {
  const { add, close } = ToastPrimitive.useToastManager();

  return useMemo(
    () => ({
      success: (message: string, description?: string) =>
        add({ ...toastOptions("success", message), description }),
      error: (message: string, description?: string) =>
        add({ ...toastOptions("error", message), description }),
      info: (message: string, description?: string) =>
        add({ ...toastOptions("info", message), description }),
      dismiss: (id?: string) => close(id),
    }),
    [add, close],
  );
}

export { ToastProvider, useToast };
