/**
 * The minimal shape this module needs from the platform request/response.
 *
 * NestJS hands `@Req()`/`@Res()` the underlying Express objects at runtime
 * (the app is built on `@nestjs/platform-express`) regardless of how they are
 * typed here. `express`'s own types are not a direct dependency of this
 * package — only reachable transitively through `@nestjs/platform-express` —
 * so this states the handful of members actually used instead of adding one.
 */

export interface CookieOptions {
  readonly httpOnly: boolean;
  readonly sameSite: "lax";
  readonly secure: boolean;
  readonly path: string;
  readonly expires?: Date;
}

export interface ResponseWithCookies {
  cookie(name: string, value: string, options: CookieOptions): void;
  clearCookie(name: string, options: Omit<CookieOptions, "expires">): void;
}

export interface RequestWithCookieHeader {
  readonly headers: { readonly cookie?: string };
  readonly ip?: string;
  readonly socket?: { readonly remoteAddress?: string };
}
