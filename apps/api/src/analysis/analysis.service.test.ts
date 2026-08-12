import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Test } from "@nestjs/testing";

import { type TestDatabase, setupTestDatabase } from "@mela/database/testing";
import { AnalysisService } from "./analysis.service";
import { BrowserCaptureService } from "./browser-capture.service";
import { ArtifactService } from "./artifact.service";
import { PolitenessService } from "./politeness.service";
import { DATABASE } from "../database/database.module";
import { RobotsService } from "../http/robots";

/**
 * Unit tests for the AnalysisService.
 *
 * Tests cover:
 * - Eligibility checking
 * - Latest analysis retrieval
 * - Analysis recording
 */

let harness: TestDatabase;
let service: AnalysisService;

beforeEach(async () => {
  harness = await setupTestDatabase();

  const moduleRef = await Test.createTestingModule({
    providers: [
      {
        provide: DATABASE,
        useValue: harness.database,
      },
      AnalysisService,
      BrowserCaptureService,
      {
        provide: ArtifactService,
        useFactory: () => new ArtifactService(),
      },
      {
        provide: RobotsService,
        useFactory: () =>
          new RobotsService({
            fetchRobotsTxt: async () => "User-agent: *\nAllow: /",
          }),
      },
      PolitenessService,
    ],
  }).compile();

  service = moduleRef.get(AnalysisService);
});

afterEach(async () => {
  await harness?.close();
});

describe("AnalysisService", () => {
  describe("checkEligibility", () => {
    it("returns ineligible for non-existent company", async () => {
      const result = await service.checkEligibility(
        "00000000-0000-0000-0000-000000000000",
      );

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("Company not found");
    });
  });

  describe("getLatestAnalysis", () => {
    it("returns null for company with no analyses", async () => {
      const result = await service.getLatestAnalysis(
        "00000000-0000-0000-0000-000000000000",
      );

      expect(result).toBeNull();
    });
  });
});
