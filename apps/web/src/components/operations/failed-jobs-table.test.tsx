import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FailedJob } from "@/lib/operations";
import { FailedJobsTable } from "./failed-jobs-table";

function job(overrides: Partial<FailedJob>): FailedJob {
  return {
    dlqId: "dlq-1",
    queueName: "website-analysis",
    url: "https://api.example.com/api/jobs/website-analysis",
    failedAt: "2026-01-01T00:00:00.000Z",
    responseStatus: 500,
    reason: "Timed out fetching the target site.",
    ...overrides,
  };
}

describe("FailedJobsTable", () => {
  it("shows an empty state rather than an empty table", () => {
    render(<FailedJobsTable jobs={[]} onRetry={vi.fn()} />);

    expect(screen.getByText("No failed jobs.")).toBeInTheDocument();
  });

  it("calls the retry action for the clicked job and reports success", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn().mockResolvedValue({ ok: true });

    render(<FailedJobsTable jobs={[job({ dlqId: "dlq-1" })]} onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("Retried")).toBeInTheDocument());
    expect(onRetry).toHaveBeenCalledWith("dlq-1");
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the error and keeps the retry button when the action fails", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn().mockResolvedValue({ ok: false, error: "QStash did not respond." });

    render(<FailedJobsTable jobs={[job({ dlqId: "dlq-1" })]} onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("QStash did not respond.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("retries the correct job among several", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn().mockResolvedValue({ ok: true });

    render(
      <FailedJobsTable
        jobs={[
          job({ dlqId: "dlq-1", queueName: "scoring" }),
          job({ dlqId: "dlq-2", queueName: "discovery" }),
        ]}
        onRetry={onRetry}
      />,
    );

    const buttons = screen.getAllByRole("button", { name: "Retry" });
    await user.click(buttons[1]!);

    await waitFor(() => expect(onRetry).toHaveBeenCalledWith("dlq-2"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
