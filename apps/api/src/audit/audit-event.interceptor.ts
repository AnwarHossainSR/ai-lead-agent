import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Observable } from "rxjs";
import { catchError, concatMap, from } from "rxjs";

import { REQUIRES_ROLE_KEY, type RequiresRoleMetadata } from "../auth/requires-role.decorator";
import type { RequestWithAccount } from "../auth/session.guard";
import { AuditService } from "./audit.service";
import { slugify } from "./slugify";

/**
 * Audits every consequential action (task 7.1) — defined here as every route
 * carrying `@RequiresRole`, the same set task 5.2 already identified as
 * consequential enough to gate by role. A route with no `@RequiresRole` is
 * read-only or open to any signed-in account, and is not audited.
 *
 * Runs after the guard (interceptors always do), so `request.account` is
 * set. The event name is derived from the same `action` string the guard
 * already puts in its 403 message, so there is exactly one place that names
 * an action rather than two that could drift apart.
 */
@Injectable()
export class AuditEventInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const requiresRole = this.reflector.getAllAndOverride<RequiresRoleMetadata | undefined>(
      REQUIRES_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiresRole === undefined) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithAccount>();
    const event = slugify(requiresRole.action);
    const subjectType = slugify(context.getClass().name.replace(/Controller$/, ""));
    const subjectId = typeof request.params?.id === "string" ? request.params.id : undefined;
    const sourceAddress = request.ip ?? request.socket?.remoteAddress;

    return next.handle().pipe(
      concatMap(async (value) => {
        await this.auditService.record({
          accountId: request.account?.id,
          event,
          outcome: "succeeded",
          subjectType,
          subjectId,
          sourceAddress,
        });
        return value;
      }),
      catchError((error: unknown) =>
        from(
          (async () => {
            await this.auditService.record({
              accountId: request.account?.id,
              event,
              outcome: "failed",
              subjectType,
              subjectId,
              sourceAddress,
            });
            throw error;
          })(),
        ),
      ),
    );
  }
}
