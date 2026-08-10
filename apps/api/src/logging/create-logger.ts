import { type ApiEnv } from "@mela/config/env";
import { ConsoleLogger, type LoggerService } from "@nestjs/common";

/**
 * Pretty, coloured output for a human at a terminal; one JSON object per line
 * everywhere else, which is what a log aggregator can actually index.
 *
 * No transport, no correlation IDs and no request logging yet — those arrive
 * with the observability phase. The constraint that matters now is that no
 * credential reaches the output, which is upheld upstream: `@mela/config`
 * strips raw values out of environment validation errors, and the health
 * checks build their messages from a fixed vocabulary rather than from driver
 * error text.
 */
export function createLogger(nodeEnv: ApiEnv["NODE_ENV"]): LoggerService {
  const development = nodeEnv === "development";

  return new ConsoleLogger({
    json: !development,
    colors: development,
    timestamp: development,
  });
}
