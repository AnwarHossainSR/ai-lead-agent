import { cookies } from "next/headers";

import type { ActionResult } from "./action-result";
import {
  FLASH_TOAST_COOKIE,
  FLASH_TOAST_MAX_AGE_SECONDS,
  type FlashToast,
  parseFlashToast,
} from "./flash-toast";

/**
 * The server half of the flash toast (design D6). The cookie is set in a Server
 * Action — the only place Next.js allows a cookie to be written — and is cleared
 * by the provider once the toast is raised, since a layout renders during a
 * request it may not mutate. `Max-Age` is a backstop for the case where the
 * destination never renders.
 */
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

/** The pending toast, if there is one. */
export async function readFlashToast(): Promise<FlashToast | null> {
  try {
    const store = await cookies();
    return parseFlashToast(store.get(FLASH_TOAST_COOKIE)?.value);
  } catch {
    return null;
  }
}
