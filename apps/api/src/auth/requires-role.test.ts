import "reflect-metadata";

import type { INestApplication } from "@nestjs/common";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { AI_SERVICE } from "../ai/ai.module";
import { ResearchController } from "../research/research.controller";
import { createTestApp } from "../testing/app";
import { authedRequest } from "../testing/authed-request";
import { createAuthenticatedContext } from "../testing/authenticated-context";
import { REQUIRES_ROLE_KEY, type RequiresRoleMetadata } from "./requires-role.decorator";

/**
 * API tests for task 5.3: every route carrying `@RequiresRole("operator", ...)`
 * refuses a viewer — naming the action and the required role, and without
 * ever reaching the AI service for the routes that would otherwise spend on
 * a model call — while an operator is let through the role check.
 *
 * A nonexistent-but-well-shaped resource id is used throughout: the guard
 * runs before the route handler, so a viewer is refused before any lookup
 * happens, and an operator being let past the guard shows up as *some*
 * response other than 403 (typically 404, since the resource does not
 * exist) — this test is about the role check, not the downstream resource
 * lookup, which the other controller tests already cover.
 */

const FAKE_ID = "00000000-0000-0000-0000-000000000000";

interface GatedRoute {
  readonly name: string;
  readonly method: "post";
  readonly path: string;
  readonly body?: Record<string, unknown>;
  readonly action: string;
  readonly triggersModelCall: boolean;
}

const GATED_ROUTES: readonly GatedRoute[] = [
  {
    name: "draft outreach",
    method: "post",
    path: `/api/leads/${FAKE_ID}/outreach/draft`,
    body: { contactId: FAKE_ID, channelId: "email" },
    action: "Drafting outreach",
    triggersModelCall: true,
  },
  {
    name: "approve outreach",
    method: "post",
    path: `/api/outreach/${FAKE_ID}/approve`,
    action: "Approving outreach",
    triggersModelCall: false,
  },
  {
    name: "reject outreach",
    method: "post",
    path: `/api/outreach/${FAKE_ID}/reject`,
    body: { reason: "Not a fit." },
    action: "Rejecting outreach",
    triggersModelCall: false,
  },
  {
    name: "record outreach sent",
    method: "post",
    path: `/api/outreach/${FAKE_ID}/sent`,
    body: { sentAt: new Date().toISOString(), means: "gmail" },
    action: "Recording outreach as sent",
    triggersModelCall: false,
  },
  {
    name: "classify outreach response",
    method: "post",
    path: `/api/outreach/${FAKE_ID}/responses/classify`,
    body: { replyText: "Not interested, thanks." },
    action: "Classifying an outreach response",
    triggersModelCall: true,
  },
  {
    name: "mark company do-not-contact",
    method: "post",
    path: `/api/companies/${FAKE_ID}/do-not-contact`,
    body: { reason: "Asked to stop." },
    action: "Marking a company do-not-contact",
    triggersModelCall: false,
  },
  {
    name: "clear company do-not-contact",
    method: "post",
    path: `/api/companies/${FAKE_ID}/clear-do-not-contact`,
    action: "Clearing a company's do-not-contact marker",
    triggersModelCall: false,
  },
  {
    name: "mark contact do-not-contact",
    method: "post",
    path: `/api/contacts/${FAKE_ID}/do-not-contact`,
    body: { reason: "Asked to stop." },
    action: "Marking a contact do-not-contact",
    triggersModelCall: false,
  },
  {
    name: "clear contact do-not-contact",
    method: "post",
    path: `/api/contacts/${FAKE_ID}/clear-do-not-contact`,
    action: "Clearing a contact's do-not-contact marker",
    triggersModelCall: false,
  },
  {
    name: "generate research summary",
    method: "post",
    path: `/api/leads/${FAKE_ID}/research-summary`,
    body: {},
    action: "Generating a research summary",
    triggersModelCall: true,
  },
  {
    name: "run opportunity analysis",
    method: "post",
    path: `/api/opportunity/analysis/${FAKE_ID}`,
    action: "Running opportunity analysis",
    triggersModelCall: true,
  },
];

let harness: TestDatabase;
let app: INestApplication | undefined;
let aiRun: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  aiRun = vi.fn().mockResolvedValue({});
  app = await createTestApp({ DATABASE_URL: harness.url }, [
    { token: AI_SERVICE, useValue: { run: aiRun } },
  ]);
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

afterAll(async () => {
  await harness?.close();
});

describe("@RequiresRole on consequential and model-triggering routes", () => {
  for (const route of GATED_ROUTES) {
    describe(route.name, () => {
      it("refuses a viewer, naming the action and the operator role", async () => {
        const { cookie } = await createAuthenticatedContext(harness.database, "viewer");
        const server = app?.getHttpServer();

        let req = authedRequest(server, cookie)[route.method](route.path);
        if (route.body !== undefined) {
          req = req.send(route.body);
        }
        const response = await req.expect(403);

        expect(response.body.message).toContain(route.action);
        expect(response.body.message).toContain("operator");

        if (route.triggersModelCall) {
          expect(aiRun).not.toHaveBeenCalled();
        }
      });

      it("does not refuse an operator on role grounds", async () => {
        const { cookie } = await createAuthenticatedContext(harness.database, "operator");
        const server = app?.getHttpServer();

        let req = authedRequest(server, cookie)[route.method](route.path);
        if (route.body !== undefined) {
          req = req.send(route.body);
        }
        const response = await req;

        expect(response.status).not.toBe(403);
      });
    });
  }

  // `ResearchController` (contact research) is defined but its module is not
  // yet imported into `AppModule` — a pre-existing gap this change did not
  // introduce and is out of scope to close here (see tasks.md). It cannot be
  // reached over HTTP in the running app, so its gating is verified directly
  // on the decorator metadata instead, the same metadata the guard reads.
  it("gates contact research (route not yet wired into AppModule)", () => {
    const metadata = Reflect.getMetadata(
      REQUIRES_ROLE_KEY,
      ResearchController.prototype.researchContacts,
    ) as RequiresRoleMetadata | undefined;

    expect(metadata).toEqual({ role: "operator", action: "Running contact research" });
  });
});
