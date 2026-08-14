import { Global, Module } from "@nestjs/common";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

/**
 * Credentials, sessions and (from section 4 on) the guard that reads them.
 *
 * Global because the guard registered with `APP_GUARD` needs `AuthService`
 * injectable everywhere a request lands, the same reasoning `EnvModule` and
 * `DatabaseModule` already use.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
