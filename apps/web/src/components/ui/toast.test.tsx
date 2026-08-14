import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FLASH_TOAST_COOKIE } from "@/lib/flash-toast";
import { ToastProvider, useToast } from "./toast";

function Raiser({ label, tone }: { label: string; tone: "success" | "error" | "info" }) {
  const toast = useToast();

  return (
    <button type="button" onClick={() => toast[tone](label)}>
      Raise {label}
    </button>
  );
}

function Harness({ tones }: { tones: ReadonlyArray<[string, "success" | "error" | "info"]> }) {
  return (
    <ToastProvider>
      {tones.map(([label, tone]) => (
        <Raiser key={label} label={label} tone={tone} />
      ))}
    </ToastProvider>
  );
}

afterEach(() => {
  document.cookie = `${FLASH_TOAST_COOKIE}=; Path=/; Max-Age=0`;
});

describe("<ToastProvider>", () => {
  it("confirms a successful action", async () => {
    const user = userEvent.setup();
    render(<Harness tones={[["Message approved", "success"]]} />);

    await user.click(screen.getByRole("button", { name: "Raise Message approved" }));

    expect(await screen.findByText("Message approved")).toBeInTheDocument();
  });

  it("puts an error in an assertive region and a success in the polite one", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        tones={[
          ["Approved", "success"],
          ["Could not reach the API", "error"],
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Raise Approved" }));
    await user.click(screen.getByRole("button", { name: "Raise Could not reach the API" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not reach the API");
    expect(alert).not.toHaveTextContent("Approved");

    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Approved");
  });

  it("does not move focus to the notification", async () => {
    const user = userEvent.setup();
    render(<Harness tones={[["Retried", "success"]]} />);

    const trigger = screen.getByRole("button", { name: "Raise Retried" });
    await user.click(trigger);
    await screen.findByText("Retried");

    expect(document.activeElement).toBe(trigger);
  });

  it("bounds the stack and drops the oldest toast", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider limit={2}>
        <Raiser label="First" tone="info" />
        <Raiser label="Second" tone="info" />
        <Raiser label="Third" tone="info" />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Raise First" }));
    await user.click(screen.getByRole("button", { name: "Raise Second" }));
    await user.click(screen.getByRole("button", { name: "Raise Third" }));

    const region = screen.getByRole("region", { name: "Notifications" });
    await waitFor(() => expect(region).not.toHaveTextContent("First"));
    expect(region).toHaveTextContent("Second");
    expect(region).toHaveTextContent("Third");
  });

  it("dismisses each toast after its interval", async () => {
    // `shouldAdvanceTime` keeps `user-event`'s own waits moving; without it the
    // first click never settles under fake timers.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
      render(
        <ToastProvider timeout={1000}>
          <Raiser label="Saved" tone="success" />
        </ToastProvider>,
      );

      await user.click(screen.getByRole("button", { name: "Raise Saved" }));
      expect(screen.getByText("Saved")).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets the user dismiss a toast early", async () => {
    const user = userEvent.setup();
    render(<Harness tones={[["Job retried", "success"]]} />);

    await user.click(screen.getByRole("button", { name: "Raise Job retried" }));
    await screen.findByText("Job retried");

    // Base UI keeps the close control out of the accessibility tree until the
    // viewport is focused — a keyboard user dismisses the focused toast
    // directly — so it is reached here by its label rather than by role.
    await user.click(screen.getByLabelText("Dismiss notification"));

    await waitFor(() => expect(screen.queryByText("Job retried")).not.toBeInTheDocument());
  });

  it("raises a flash toast exactly once and clears the cookie", async () => {
    document.cookie = `${FLASH_TOAST_COOKIE}=${encodeURIComponent(
      JSON.stringify({ tone: "success", message: "Signed out" }),
    )}; Path=/`;

    const { rerender } = render(
      <ToastProvider initialToast={{ tone: "success", message: "Signed out" }}>
        <p>workspace</p>
      </ToastProvider>,
    );

    expect(await screen.findAllByText("Signed out")).toHaveLength(1);
    expect(document.cookie).not.toContain(FLASH_TOAST_COOKIE);

    rerender(
      <ToastProvider initialToast={{ tone: "success", message: "Signed out" }}>
        <p>workspace</p>
      </ToastProvider>,
    );

    expect(screen.getAllByText("Signed out")).toHaveLength(1);
  });
});
