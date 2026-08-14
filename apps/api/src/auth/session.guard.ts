import { SESSION_COOKIE_NAME } from "@mela/config";
import type { PublicAccountRow } from "@mela/database";
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AuthService } from "./auth.service";
import { parseCookieHeader } from "./cookie";
import type { RequestWithCookieHeader } from "./http-types";
import { IS_PUBLIC_KEY } from "./public.decorator";

export interface RequestWithAccount extends RequestWithCookieHeader {
  account?: PublicAccountRow;
  sessionId?: string;
}

const SIGN_IN_REQUIRED_MESSAGE = "Sign in required.";

/**
 * Deny by default (design D1): rejects every request without a valid
 * session, except a route explicitly marked `@Public()`.
 *
 * Registered globally via `APP_GUARD` — a controller cannot opt out of it,
 * only a handler or a whole controller can opt in to being public. The
 * failure mode of forgetting the decorator is a 401 during development,
 * which is loud; the failure mode of the reverse would be silent data
 * exposure.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAccount>();
    const token = parseCookieHeader(request.headers.cookie)[SESSION_COOKIE_NAME];

    if (token === undefined) {
      throw new UnauthorizedException(SIGN_IN_REQUIRED_MESSAGE);
    }

    const authenticated = await this.authService.validateSessionToken(token);

    if (authenticated === null) {
      throw new UnauthorizedException(SIGN_IN_REQUIRED_MESSAGE);
    }

    request.account = authenticated.account;
    request.sessionId = authenticated.sessionId;

    return true;
  }
}
