import { EnvironmentValidationError } from "./load";

/**
 * Refuses startup when the metrics port equals the application port.
 * A separate port ensures metrics are not reachable on the application port
 * (design D3).
 */
export function assertMetricsPortDiffersFromAppPort(env: {
  API_PORT: number;
  METRICS_PORT: number;
}): void {
  if (env.METRICS_PORT === env.API_PORT) {
    const message = [
      "Invalid environment configuration for the API.",
      "",
      "  METRICS_PORT",
      `    Purpose: TCP port the Prometheus metrics endpoint is served on.`,
      `    Problem: Must differ from API_PORT (${env.API_PORT}).`,
      "",
      "Set this in the git-ignored local environment file. See .env.example for the full list.",
    ].join("\n");

    throw new EnvironmentValidationError("the API", ["METRICS_PORT"], message);
  }
}
