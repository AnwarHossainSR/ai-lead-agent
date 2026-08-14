import { type ApiEnv } from "@mela/config/env";
import { type LoggerService } from "@nestjs/common";

import { CorrelatedLogger } from "./correlated-logger";

/**
 * Pretty, coloured output for a human at a terminal; one JSON object per line
 * everywhere else, which is what a log aggregator can actually index.
 *
 * Every log line carries the current correlation identifier and process role
 * from the `AsyncLocalStorage` context set by the correlation interceptor
 * (API) or the job processor (worker).
 */
export function createLogger(nodeEnv: ApiEnv["NODE_ENV"]): LoggerService {
  const development = nodeEnv === "development";

  return new CorrelatedLogger({
    json: !development,
    colors: development,
    timestamp: development,
  });
}
