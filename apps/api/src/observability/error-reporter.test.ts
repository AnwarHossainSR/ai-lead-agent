import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installErrorHandlers, reportError, resetReportState } from "./error-reporter";

describe("reportError", () => {
  beforeEach(() => {
    resetReportState();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does nothing when no DSN is configured", () => {
    reportError(new Error("test"), undefined);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does nothing when DSN is empty", () => {
    reportError(new Error("test"), "");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends a redacted error report to the DSN", async () => {
    const dsn = "https://errors.example.com/report";
    const error = new Error("Connection failed");

    reportError(error, dsn);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe(dsn);
    expect(call[1].method).toBe("POST");

    const body = JSON.parse(call[1].body as string) as Record<string, unknown>;
    expect(body.message).toBe("Connection failed");
    expect(body.name).toBe("Error");
    expect(body.timestamp).toBeDefined();
  });

  it("redacts connection strings in error messages", async () => {
    const error = new Error("Auth failed connecting to postgres://admin:pw@db:5432/prod");

    reportError(error, "https://errors.example.com/report");

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as Record<string, unknown>;
    expect(body.message).not.toContain("postgres://admin:pw@db:5432/prod");
    expect(body.message).toContain("<redacted:connection-string>");
  });

  it("reports only once even when called multiple times", () => {
    const dsn = "https://errors.example.com/report";
    reportError(new Error("first"), dsn);
    reportError(new Error("second"), dsn);
    reportError(new Error("third"), dsn);

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("handles non-Error rejections", async () => {
    reportError("string rejection", "https://errors.example.com/report");

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string) as Record<string, unknown>;
    expect(body.message).toBe("string rejection");
    expect(body.name).toBe("UnknownError");
  });

  it("does not throw when the destination is unreachable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    expect(() =>
      reportError(new Error("test"), "https://unreachable.example.com/report"),
    ).not.toThrow();
  });
});

describe("installErrorHandlers", () => {
  it("registers uncaughtException and unhandledRejection handlers", () => {
    const onSpy = vi.spyOn(process, "on");
    installErrorHandlers("https://errors.example.com/report");

    expect(onSpy).toHaveBeenCalledWith("uncaughtException", expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith("unhandledRejection", expect.any(Function));
  });
});
