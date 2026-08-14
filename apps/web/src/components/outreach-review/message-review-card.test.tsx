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
  canApprove: true,
  approval: null,
  rejection: null,
  send: null,
  onApprove: vi.fn().mockResolvedValue({ ok: true }),
  onReject: vi.fn().mockResolvedValue({ ok: true }),
  onCancel: vi.fn().mockResolvedValue({ ok: true }),
  onSave: vi.fn().mockResolvedValue({ ok: true }),
  onRecordSent: vi.fn().mockResolvedValue({ ok: true }),
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

  it("shows who approved, rejected or recorded a send, and when", () => {
    // "approved" is itself actionable (offers Record as sent), so approval
    // attribution is only rendered once the message has moved past it —
    // "sent" here, alongside its own send attribution.
    const { rerender } = render(
      <MessageReviewCard
        {...BASE_PROPS}
        status="sent"
        approval={{ email: "ops@example.com", at: "2026-01-01T00:00:00Z" }}
      />,
    );
    expect(screen.getByText(/Approved by ops@example.com at/)).toBeInTheDocument();

    rerender(
      <MessageReviewCard
        {...BASE_PROPS}
        status="rejected"
        rejectionReason="Not a fit."
        rejection={{ email: "ops@example.com", at: "2026-01-02T00:00:00Z" }}
      />,
    );
    expect(screen.getByText(/Rejected by ops@example.com at/)).toBeInTheDocument();

    rerender(
      <MessageReviewCard
        {...BASE_PROPS}
        status="sent"
        send={{ email: "ops@example.com", at: "2026-01-03T00:00:00Z", means: "Gmail" }}
      />,
    );
    expect(screen.getByText(/Recorded sent by ops@example.com via Gmail at/)).toBeInTheDocument();
  });

  /**
   * Task 8.4: a viewer sees no approve, reject or record-send control — the
   * API refuses the request anyway either way (`auth/requires-role.test.ts`
   * on the API side), so this is belt and braces, not the only defence.
   */
  it("hides Approve, Reject and Record as sent for a viewer (canApprove: false)", () => {
    const { rerender } = render(<MessageReviewCard {...BASE_PROPS} canApprove={false} />);
    markViewed();

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject…" })).not.toBeInTheDocument();
    // Edit and Cancel are not role-gated on the API side, so they stay visible.
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    rerender(<MessageReviewCard {...BASE_PROPS} canApprove={false} status="approved" />);
    expect(screen.queryByRole("button", { name: "Record as sent…" })).not.toBeInTheDocument();
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

  /**
   * The API refuses approve and reject once a message is already approved
   * (both are reachable only from draft/pending_approval), so an approved
   * message gets a different action set entirely rather than buttons that
   * would just error.
   */
  it("offers no Approve or Reject for an already-approved message", () => {
    render(<MessageReviewCard {...BASE_PROPS} status="approved" />);

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject…" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record as sent…" })).toBeInTheDocument();
  });

  it("describes recording a send as recording, not sending, and does not offer a send control", async () => {
    const user = userEvent.setup();
    render(<MessageReviewCard {...BASE_PROPS} status="approved" />);

    await user.click(screen.getByRole("button", { name: "Record as sent…" }));

    expect(screen.getByText(/does not send anything/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^send$/i })).not.toBeInTheDocument();
  });

  it("requires the means before recording, then calls onRecordSent with the means and time", async () => {
    const user = userEvent.setup();
    const onRecordSent = vi.fn().mockResolvedValue({ ok: true });
    render(<MessageReviewCard {...BASE_PROPS} status="approved" onRecordSent={onRecordSent} />);

    await user.click(screen.getByRole("button", { name: "Record as sent…" }));
    expect(screen.getByRole("button", { name: "Record as sent" })).toBeDisabled();

    await user.type(screen.getByLabelText("How was it sent?"), "Gmail");
    expect(screen.getByRole("button", { name: "Record as sent" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Record as sent" }));

    expect(onRecordSent).toHaveBeenCalledTimes(1);
    expect(onRecordSent).toHaveBeenCalledWith(
      "outreach-1",
      expect.objectContaining({ means: "Gmail" }),
    );
    expect(await screen.findByText("Recorded as sent.")).toBeInTheDocument();
  });
});
