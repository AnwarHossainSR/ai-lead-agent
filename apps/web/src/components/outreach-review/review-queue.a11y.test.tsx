import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OutreachClaim } from "@/lib/outreach";
import { axe } from "@/testing/axe";
import { CitedFactsPanel } from "./cited-facts-panel";
import { MessageReviewCard } from "./message-review-card";

/** jsdom has no IntersectionObserver; MessageReviewCard only needs it to exist, not fire. */
beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CLAIMS: readonly OutreachClaim[] = [
  {
    text: "Runs a mid-size logistics operation in Dubai.",
    citations: [
      {
        ref: "o1",
        detail: "Matched in the About page.",
        url: "https://example.com/about",
        certainty: "observed",
      },
    ],
  },
];

describe("Outreach review queue accessibility (task 9.1)", () => {
  it("MessageReviewCard has no violations before approval is enabled", async () => {
    const { container } = render(
      <MessageReviewCard
        outreachId="outreach-1"
        status="pending_approval"
        channel="email"
        subject="Hello"
        messageBody="Message body text."
        isHumanEdited={false}
        rejectionReason={null}
        onApprove={vi.fn().mockResolvedValue({ ok: true })}
        onReject={vi.fn().mockResolvedValue({ ok: true })}
        onCancel={vi.fn().mockResolvedValue({ ok: true })}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
        onRecordSent={vi.fn().mockResolvedValue({ ok: true })}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("CitedFactsPanel has no violations", async () => {
    const { container } = render(
      <CitedFactsPanel claims={CLAIMS} recordedAt="2026-01-01T00:00:00Z" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
