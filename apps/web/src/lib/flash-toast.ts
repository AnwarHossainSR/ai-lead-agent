import { cookies } from "next/headers";
import { z } from "zod";

import type { ActionResult } from "./action-result";

/**
 * Carrying an action's outcome across a redirect (design D6).
 *
 * An action that navigates cannot return its result to the form that called it,
 * so the message travels in a short-lived cookie that the destination layout
 * reads and hands to the toast provider as its initial toast. A query string
 * was rejected in D6: it leaks into shareable URLs and re-fires on reload.
 *
 * The cookie is set in a Server Action — the only place Next.js allows a cookie
 * to be written — and is cleared by the provider once the toast is raised, since
 * a layout renders during a request it may not mutate. `Max-Age` is a backstop
 * for the case where the destination never renders.
 */
export const FLASH_TOAST_COOKIE = "mela_flash_toast";

const FLASH_TOAST_MAX_AGE_SECONDS = 30;

const flashToastSchema = z.object({
  tone: z.enum(["success", "error", "info"]),
  message: z.string().min(1).max(300),
});

export type FlashToast = z.infer<typeof flashToastSchema>;

/** Call from a Server Action, before its `redirect`. */
export async function setFlashToast(result: ActionResult): Promise<void> {
  const flash: FlashToast = {
    tone: result.status === "success" ? "success" : "error",
    message: result.message,
  };

  const store = await cookies();
  store.set(FLASH_TOAST_COOKIE, JSON.stringify(flash), {
    path: "/",
    maxAge: FLASH_TOAST_MAX_AGE_SECONDS,
    // Readable by the client on purpose: it holds a message the user is about
    // to be shown, and the provider clears it once the toast is raised. Nothing
    // sensitive belongs in it — never a token, an id or an error body.
    httpOnly: false,
    sameSite: "lax",
  });
}

/**
 * The pending toast, if there is one. A malformed or hand-edited cookie is
 * ignored rather than thrown over — a decoration must never break a page.
 */
export async function readFlashToast(): Promise<FlashToast | null> {
  try {
    const store = await cookies();
    const raw = store.get(FLASH_TOAST_COOKIE)?.value;
    if (raw === undefined) return null;

    const parsed = flashToastSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
