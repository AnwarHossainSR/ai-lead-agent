import { getCorrelationId, getProcessRole } from "../logging/correlation-context";
import { redact } from "../logging/redacting-serializer";

const SHUTDOWN_FLUSH_TIMEOUT_MS = 5_000;

interface ErrorReport {
  readonly message: string;
  readonly stack?: string;
  readonly name: string;
  readonly correlationId?: string;
  readonly role?: string;
  readonly timestamp: string;
}

let reported = false;

/** Resets the "reported once" guard. For testing only. */
export function resetReportState(): void {
  reported = false;
}

/**
 * Reports an unhandled exception or rejection once, applying the same
 * redaction as the logger. No-ops when `ERROR_REPORTING_DSN` is unset.
 * The flush on shutdown is bounded by a timeout so the process always exits.
 */
export function reportError(error: unknown, dsn: string | undefined): void {
  if (dsn === undefined || dsn.length === 0) return;
  if (reported) return;
  reported = true;

  const raw =
    error instanceof Error
      ? { message: error.message, stack: error.stack, name: error.name }
      : { message: String(error), name: "UnknownError" };

  const report: ErrorReport = {
    ...(redact(raw) as Omit<ErrorReport, "correlationId" | "role" | "timestamp">),
    correlationId: getCorrelationId(),
    role: getProcessRole(),
    timestamp: new Date().toISOString(),
  };

  void sendReport(dsn, report);
}

async function sendReport(dsn: string, report: ErrorReport): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SHUTDOWN_FLUSH_TIMEOUT_MS);

    await fetch(dsn, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      signal: controller.signal,
    });

    clearTimeout(timeout);
  } catch {
    // A failing reporter must not prevent the process from shutting down.
  }
}

/**
 * Installs unhandled exception and rejection handlers that report once
 * through the configured DSN.
 */
export function installErrorHandlers(dsn: string | undefined): void {
  process.on("uncaughtException", (error: Error) => {
    reportError(error, dsn);
  });

  process.on("unhandledRejection", (reason: unknown) => {
    reportError(reason, dsn);
  });
}
