import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionGuard } from "./session.guard";

/**
 * Credentials, sessions and the guard that reads them (design D1).
 *
 * Global because the `APP_GUARD` runs on every request in every module, and
 * because `AuthService` needs to be injectable everywhere a request lands —
 * the same reasoning `EnvModule` and `DatabaseModule` already use.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [AuthService],
})
export class AuthModule {}
