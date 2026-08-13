"use server";

import { revalidatePath } from "next/cache";

import { apiUrl } from "@/lib/api";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Calls a mutating outreach endpoint. Distinct from `fetchWithTimeout`
 * (design D7's passive-render helper): an action is triggered by a person
 * clicking a button, so it reports what went wrong rather than degrading
 * silently, and has no timeout of its own — a mutation should not be
 * abandoned mid-flight.
 */
async function callOutreachApi(path: string, init?: RequestInit): Promise<ActionResult> {
  const url = apiUrl(path);

  if (url === null) {
    return { ok: false, error: "API_URL is not configured." };
  }

  try {
    const response = await fetch(url, { ...init, cache: "no-store" });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return {
        ok: false,
        error: body?.message ?? `Request failed with status ${response.status}.`,
      };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error." };
  }
}

/** Server Actions calling the API; `revalidatePath` after each is the whole cache story (design D1). */

export async function approveOutreachAction(outreachId: string): Promise<ActionResult> {
  const result = await callOutreachApi(`/outreach/${outreachId}/approve`, { method: "POST" });
  if (result.ok) {
    revalidatePath("/outreach/review");
    revalidatePath(`/outreach/review/${outreachId}`);
  }
  return result;
}

export async function rejectOutreachAction(
  outreachId: string,
  reason: string,
): Promise<ActionResult> {
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "A rejection reason is required." };
  }

  const result = await callOutreachApi(`/outreach/${outreachId}/reject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason: trimmed }),
  });
  if (result.ok) {
    revalidatePath("/outreach/review");
    revalidatePath(`/outreach/review/${outreachId}`);
  }
  return result;
}

export async function cancelOutreachAction(outreachId: string): Promise<ActionResult> {
  const result = await callOutreachApi(`/outreach/${outreachId}/cancel`, { method: "POST" });
  if (result.ok) {
    revalidatePath("/outreach/review");
    revalidatePath(`/outreach/review/${outreachId}`);
  }
  return result;
}

export async function updateOutreachAction(
  outreachId: string,
  changes: { subject?: string; messageBody?: string },
): Promise<ActionResult> {
  const result = await callOutreachApi(`/outreach/${outreachId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (result.ok) {
    revalidatePath("/outreach/review");
    revalidatePath(`/outreach/review/${outreachId}`);
  }
  return result;
}
