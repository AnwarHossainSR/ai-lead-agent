"use server";

import { SESSION_COOKIE_NAME } from "@mela/config";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { actionSuccess } from "@/lib/action-result";
import { apiUrl } from "@/lib/api";
import { setFlashToast } from "@/lib/flash-toast.server";
import { sessionCookieHeader } from "@/lib/session-cookie";

/** Signs out the current session (task 8.3) and returns to the sign-in page. */
export async function signOutAction(): Promise<void> {
  const url = apiUrl("/auth/sign-out");

  if (url !== null) {
    await fetch(url, { method: "POST", cache: "no-store", headers: await sessionCookieHeader() });
  }

  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);

  // The redirect leaves no result for the form to hold, so the confirmation
  // travels in the flash cookie and is raised by the sign-in page's layout.
  await setFlashToast(actionSuccess("Signed out."));

  redirect("/sign-in");
}
