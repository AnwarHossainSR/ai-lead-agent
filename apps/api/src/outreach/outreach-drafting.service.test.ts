import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AIService } from "@mela/ai";
import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { companyInput, leadInput } from "@mela/database/testing/fixtures";
import { insertCompany, insertLead } from "@mela/database";
import { DATABASE } from "../database/database.module";
import { OutreachDraftingService } from "./outreach-drafting.service";

describe("outreach-drafting service", () => {
  let harness: TestDatabase;
  let service: OutreachDraftingService;
  let companyId: string;

  beforeEach(async () => {
    harness = await setupTestDatabase();

    const company = await insertCompany(harness.database, companyInput());
    companyId = company.id;

    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: DATABASE,
          useValue: harness.database,
        },
        {
          provide: "AI_SERVICE",
          useValue: {
            run: vi.fn().mockResolvedValue({
              value: {
                subject: "Website modernization for Example Trading L.L.C.",
                body: "I noticed your site loads slowly on mobile.",
                claims: [{ text: "The site loads slowly on mobile.", cites: ["s1"] }],
              },
              invocationId: "invocation-1",
              promptVersion: 1,
            }),
          } satisfies Partial<AIService>,
        },
        OutreachDraftingService,
      ],
    }).compile();

    service = moduleRef.get(OutreachDraftingService);
  });

  afterEach(async () => {
    await harness.close();
  });

  it("refuses when the lead has no current research summary", async () => {
    const lead = await insertLead(harness.database, leadInput(companyId));

    const result = await service.draftOutreach({
      leadId: lead.id,
      contactId: "contact-1",
      channelId: "email",
    });

    expect(result).toMatchObject({ reason: "Lead has no current research summary." });
  });
});
