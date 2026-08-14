import { afterEach, describe, expect, it, vi } from "vitest";

import type { OutreachRecord } from "@/lib/outreach";
import { fetchAwaitingReview } from "./awaiting-review";

function record(overrides: Partial<OutreachRecord>): OutreachRecord {
  return {
    id: "outreach-1",
    leadId: "lead-1",
    channel: "email",
    subject: "Hello",
    messageBody: "Body.",
    status: "pending_approval",
    isHumanEdited: false,
    citedFacts: [],
    rejectionReason: null,
    createdAt: "2026-01-01T00:00:00Z",
    approvedAt: null,
    approvedByAccountId: null,
    rejectedAt: null,
    rejectedByAccountId: null,
    sentAt: null,
    sentMeans: null,
    sentByAccountId: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/**
 * Task 9.7 spec audit: a freshly drafted message (status "draft") is never
 * submitted by anything in this application, so it must be reachable here
 * or the review queue can never show it at all.
 */
describe("fetchAwaitingReview", () => {
  it("merges pending_approval and draft messages, newest first", async () => {
    vi.stubEnv("API_URL", "http://localhost:3001");

    const pending = record({
      id: "pending-1",
      status: "pending_approval",
      createdAt: "2026-01-01T00:00:00Z",
    });
    const draft = record({ id: "draft-1", status: "draft", createdAt: "2026-01-02T00:00:00Z" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const body = url.includes("status=draft") ? [draft] : [pending];
        return Promise.resolve({ ok: true, status: 200, json: async () => body });
      }),
    );

    const result = await fetchAwaitingReview(10);

    expect(result).toEqual({ status: "ok", data: [draft, pending] });
  });

  it("is unreachable when API_URL is not configured", async () => {
    vi.stubEnv("API_URL", "");

    const result = await fetchAwaitingReview(10);

    expect(result.status).toBe("unreachable");
  });

  it("reports failure when either request fails", async () => {
    vi.stubEnv("API_URL", "http://localhost:3001");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("status=draft")) {
          return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }),
    );

    const result = await fetchAwaitingReview(10);

    expect(result.status).toBe("degraded");
  });
});
