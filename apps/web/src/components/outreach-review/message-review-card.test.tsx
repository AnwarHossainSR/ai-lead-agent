import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MessageReviewCard } from "./message-review-card";

/**
 * jsdom has no IntersectionObserver. Tests control the "viewed" gate
 * directly by capturing the callback and invoking it, rather than trying to
 * simulate real intersection geometry.
 */
let observeCallback: IntersectionObserverCallback | null = null;

beforeEach(() => {
  observeCallback = null;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        observeCallback = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function markViewed() {
  act(() => {
    observeCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}

const BASE_PROPS = {
  outreachId: "outreach-1",
  status: "pending_approval",
  channel: "email",
  subject: "Hello",
  messageBody: "Message body text.",
  isHumanEdited: false,
  rejectionReason: null,
  onApprove: vi.fn().mockResolvedValue({ ok: true }),
  onReject: vi.fn().mockResolvedValue({ ok: true }),
  onCancel: vi.fn().mockResolvedValue({ ok: true }),
  onSave: vi.fn().mockResolvedValue({ ok: true }),
};

describe("MessageReviewCard", () => {
  it("disables Approve until the message body has been rendered in the viewport", () => {
    render(<MessageReviewCard {...BASE_PROPS} />);

    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();

    markViewed();

    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("keeps the reject reason required before confirming", async () => {
    const user = userEvent.setup();
    render(<MessageReviewCard {...BASE_PROPS} />);

    await user.click(screen.getByRole("button", { name: "Reject…" }));
    expect(screen.getByRole("button", { name: "Confirm reject" })).toBeDisabled();

    await user.type(screen.getByLabelText("Reason for rejecting"), "Not a good fit");
    expect(screen.getByRole("button", { name: "Confirm reject" })).toBeEnabled();
  });

  it("shows an explicit notice when editing revokes an approved message", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(<MessageReviewCard {...BASE_PROPS} status="approved" onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/revoked its approval/)).toBeInTheDocument();
  });

  it("offers no bulk approval, multi-select or send control", () => {
    render(<MessageReviewCard {...BASE_PROPS} />);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^send$/i })).not.toBeInTheDocument();
  });

  it("renders a non-actionable message read-only, with its status", () => {
    render(
      <MessageReviewCard
        {...BASE_PROPS}
        status="rejected"
        rejectionReason="Not a good fit right now."
      />,
    );

    expect(
      screen.getByText(/This message is Rejected: Not a good fit right now\./),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  /**
   * Task 9.2: every interactive control in the review queue has an
   * accessible name — `getByRole(..., { name })` only finds a match when
   * the accessible name computation resolves to that string, so these
   * assertions fail on their own if a control regresses to icon-only or
   * unlabelled — and the whole flow is reachable by keyboard alone, with no
   * step that requires a pointer.
   */
  it("every action button has an accessible name", () => {
    render(<MessageReviewCard {...BASE_PROPS} />);
    markViewed();

    for (const name of ["Approve", "Edit", "Reject…", "Cancel"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("the edit fields and rejection reason each have an accessible name", async () => {
    const user = userEvent.setup();
    render(<MessageReviewCard {...BASE_PROPS} />);

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Subject")).toBeInTheDocument();
    expect(screen.getByLabelText("Message body")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel edit" }));

    await user.click(screen.getByRole("button", { name: "Reject…" }));
    expect(screen.getByLabelText("Reason for rejecting")).toBeInTheDocument();
  });

  it("is fully operable by keyboard: tab reaches Approve and Enter activates it", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn().mockResolvedValue({ ok: true });
    render(<MessageReviewCard {...BASE_PROPS} onApprove={onApprove} />);
    markViewed();

    await user.tab();
    expect(screen.getByRole("button", { name: "Approve" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onApprove).toHaveBeenCalledWith("outreach-1");
  });

  it("is fully operable by keyboard: tab reaches Reject, Enter opens the reason field, typing and Tab reach Confirm reject", async () => {
    const user = userEvent.setup();
    render(<MessageReviewCard {...BASE_PROPS} />);
    markViewed();

    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Reject…" })).toHaveFocus();

    await user.keyboard("{Enter}");
    const reasonField = screen.getByLabelText("Reason for rejecting");
    expect(reasonField).toBeInTheDocument();

    await user.type(reasonField, "Not a good fit");
    expect(screen.getByRole("button", { name: "Confirm reject" })).toBeEnabled();
  });
});
