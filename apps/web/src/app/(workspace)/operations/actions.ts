"use server";

import { revalidatePath } from "next/cache";

import { apiUrl } from "@/lib/api";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Retries one dead-lettered job (task 8.1's explicit retry action). */
export async function retryFailedJobAction(dlqId: string): Promise<ActionResult> {
  const url = apiUrl(`/operations/failed-jobs/${dlqId}/retry`);

  if (url === null) {
    return { ok: false, error: "API_URL is not configured." };
  }

  try {
    const response = await fetch(url, { method: "POST", cache: "no-store" });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return {
        ok: false,
        error: body?.message ?? `Request failed with status ${response.status}.`,
      };
    }

    revalidatePath("/operations");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error." };
  }
}
