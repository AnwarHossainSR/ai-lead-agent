import { randomUUID } from "node:crypto";

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";

import { type CorrelationContext, runWithCorrelation } from "./correlation-context";

const CORRELATION_HEADER = "x-correlation-id";

/**
 * Opens an `AsyncLocalStorage` correlation context per request, adopting an
 * inbound `x-correlation-id` header when supplied and returning it in the
 * response. Every log line emitted while handling the request carries this
 * identifier.
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ headers: Record<string, string | undefined> }>();
    const response = http.getResponse<{ setHeader(name: string, value: string): void }>();

    const inboundId = request.headers[CORRELATION_HEADER];
    const correlationId =
      typeof inboundId === "string" && inboundId.length > 0 ? inboundId : randomUUID();

    const ctx: CorrelationContext = { correlationId, role: "api" };

    return runWithCorrelation(ctx, () =>
      next.handle().pipe(
        tap(() => {
          response.setHeader(CORRELATION_HEADER, correlationId);
        }),
      ),
    );
  }
}
