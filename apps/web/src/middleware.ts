import { SESSION_COOKIE_NAME } from "@mela/config";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/sign-in"];

/**
 * Redirects an unauthenticated request to sign-in before any workspace data
 * fetch happens (task 8.2, dashboard spec: "no workspace data is rendered").
 *
 * This is a cheap gate — cookie presence, not validity (design D7): the
 * cookie could be expired, revoked, or belong to a since-disabled account,
 * and middleware has no way to ask the API without adding a network round
 * trip to every navigation. `(workspace)/layout.tsx` makes the real call
 * (`GET /api/auth/me`) and redirects again if that comes back empty — this
 * only keeps a visitor with no cookie at all from ever reaching a page that
 * would attempt to render workspace data.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSession) {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
