"use server";

import { SESSION_COOKIE_NAME } from "@mela/config";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { apiUrl } from "@/lib/api";
import { sessionCookieHeader } from "@/lib/session-cookie";

/** Signs out the current session (task 8.3) and returns to the sign-in page. */
export async function signOutAction(): Promise<void> {
  const url = apiUrl("/auth/sign-out");

  if (url !== null) {
    await fetch(url, { method: "POST", cache: "no-store", headers: await sessionCookieHeader() });
  }

  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);

  redirect("/sign-in");
}
