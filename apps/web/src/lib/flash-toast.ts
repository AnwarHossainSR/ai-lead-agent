import { z } from "zod";

/**
 * Carrying an action's outcome across a redirect (design D6).
 *
 * An action that navigates cannot return its result to the form that called it,
 * so the message travels in a short-lived cookie that the destination layout
 * reads and hands to the toast provider as its initial toast. A query string
 * was rejected in D6: it leaks into shareable URLs and re-fires on reload.
 *
 * This module is imported by the client provider, so it holds only the shape
 * and the cookie's name. Reading and writing the cookie needs `next/headers`
 * and lives in `flash-toast.server.ts`.
 */
export const FLASH_TOAST_COOKIE = "mela_flash_toast";

export const FLASH_TOAST_MAX_AGE_SECONDS = 30;

export const flashToastSchema = z.object({
  tone: z.enum(["success", "error", "info"]),
  message: z.string().min(1).max(300),
});

export type FlashToast = z.infer<typeof flashToastSchema>;

/** A malformed or hand-edited cookie is ignored: a decoration must never break a page. */
export function parseFlashToast(raw: string | undefined): FlashToast | null {
  if (raw === undefined) return null;

  try {
    const parsed = flashToastSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
