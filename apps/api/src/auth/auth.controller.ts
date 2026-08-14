import { SESSION_COOKIE_NAME, sessionCookieAttributes } from "@mela/config";
import { type ApiEnv } from "@mela/config/env";
import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { z } from "zod";

import { API_ENV } from "../config/env.module";
import { createZodDto } from "../validation/zod-dto";
import { AuthService } from "./auth.service";
import { parseCookieHeader } from "./cookie";
import type { RequestWithCookieHeader, ResponseWithCookies } from "./http-types";
import { Public } from "./public.decorator";

const signInBodySchema = z.object({
  email: z.string().trim().min(1, "Expected an email address."),
  password: z.string().min(1, "Expected a password."),
});

export class SignInDto extends createZodDto(signInBodySchema) {}

export interface SignInResponseBody {
  readonly account: { readonly id: string; readonly email: string; readonly role: string };
}

/** The source address a rate-limit bucket and an audit entry are keyed on. */
function sourceAddressOf(req: RequestWithCookieHeader): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  @Public()
  @Post("sign-in")
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body() body: SignInDto,
    @Req() req: RequestWithCookieHeader,
    @Res({ passthrough: true }) res: ResponseWithCookies,
  ): Promise<SignInResponseBody> {
    const result = await this.authService.signIn(body.email, body.password, sourceAddressOf(req));

    if (!result.ok) {
      throw result.rateLimited
        ? new HttpException(result.error, HttpStatus.TOO_MANY_REQUESTS)
        : new UnauthorizedException(result.error);
    }

    res.cookie(SESSION_COOKIE_NAME, result.token, {
      ...sessionCookieAttributes(this.env.NODE_ENV),
      expires: result.expiresAt,
    });

    return {
      account: {
        id: result.account.id,
        email: result.account.email,
        role: result.account.role,
      },
    };
  }

  @Public()
  @Post("sign-out")
  @HttpCode(HttpStatus.OK)
  async signOut(
    @Req() req: RequestWithCookieHeader,
    @Res({ passthrough: true }) res: ResponseWithCookies,
  ): Promise<{ ok: true }> {
    const token = parseCookieHeader(req.headers.cookie)[SESSION_COOKIE_NAME];

    if (token !== undefined) {
      await this.authService.signOut(token, sourceAddressOf(req));
    }

    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieAttributes(this.env.NODE_ENV));

    return { ok: true };
  }
}
