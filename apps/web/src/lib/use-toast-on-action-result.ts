"use client";

import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "./action-result";

/**
 * Raises a toast whenever a `useActionState` result changes (design D6).
 *
 * The identity of the state object is the signal: React gives a new object for
 * every action call, so two identical failures in a row are two toasts, while a
 * re-render with the same result raises nothing.
 */
export function useToastOnActionResult(state: ActionResult | null | undefined): void {
  const toast = useToast();
  const announced = useRef<ActionResult | null | undefined>(null);

  useEffect(() => {
    if (!state || state === announced.current) return;
    announced.current = state;

    if (state.status === "success") {
      toast.success(state.message);
    } else {
      toast.error(state.message);
    }
  }, [state, toast]);
}
