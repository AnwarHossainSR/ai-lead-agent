import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { AuditEventInterceptor } from "./audit-event.interceptor";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

/**
 * The audit log write and read paths (design D6, tasks 7.1/7.3).
 *
 * Global for the same reason `AuthModule` is: `AuditService` needs to be
 * injectable everywhere a consequential action happens, and the
 * `APP_INTERCEPTOR` it registers has to run for every route.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditEventInterceptor }],
  exports: [AuditService],
})
export class AuditModule {}
