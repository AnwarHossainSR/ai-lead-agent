"use server";

import { SESSION_COOKIE_NAME, sessionCookieAttributes } from "@mela/config";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { apiUrl } from "@/lib/api";

export type SignInResult = { ok: true } | { ok: false; error: string };

/** Reads one attribute (`name=value`) out of a single `Set-Cookie` header line. */
function cookieAttribute(cookieLine: string, name: string): string | undefined {
  return new RegExp(`(?:^|; )${name}=([^;]*)`, "i").exec(cookieLine)?.[1];
}

/**
 * Signs in against the API and re-issues its session cookie on this app's
 * own response (task 8.1). The API sets a cookie on *its* response to this
 * server-side fetch, which the browser never sees — this reads the token
 * and expiry back out of that `Set-Cookie` header and sets the identical
 * cookie (same name and attributes, from the one shared `@mela/config`
 * source, design D7) on the response this Server Action actually returns.
 */
export async function signInAction(
  _prevState: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string") {
    return { ok: false, error: "Enter an email and a password." };
  }

  const url = apiUrl("/auth/sign-in");
  if (url === null) {
    return { ok: false, error: "API_URL is not configured." };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error." };
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    return { ok: false, error: body?.message ?? "Incorrect email or password." };
  }

  const cookieLine = response.headers
    .getSetCookie()
    .find((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`));
  const token =
    cookieLine !== undefined ? cookieAttribute(cookieLine, SESSION_COOKIE_NAME) : undefined;

  if (token === undefined) {
    return { ok: false, error: "Signed in, but no session was issued." };
  }

  const expiresRaw = cookieAttribute(cookieLine ?? "", "Expires");

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    ...sessionCookieAttributes(process.env.NODE_ENV ?? "development"),
    expires: expiresRaw !== undefined ? new Date(expiresRaw) : undefined,
  });

  redirect("/");
}
