import { readFile, rm } from "fs/promises";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ArtifactService } from "./artifact.service";

const TEST_ARTIFACT_ROOT = join(__dirname, "../../test-artifacts");

describe("ArtifactService", () => {
  let artifactService: ArtifactService;

  beforeEach(async () => {
    artifactService = new ArtifactService(TEST_ARTIFACT_ROOT);
    await artifactService.ensureArtifactRoot();
  });

  afterEach(async () => {
    await rm(TEST_ARTIFACT_ROOT, { recursive: true, force: true });
  });

  describe("buildArtifactPath", () => {
    it("builds a relative path", () => {
      const path = artifactService.buildArtifactPath(
        "company-123",
        "analysis-456",
        "desktop-screenshot.png",
      );
      expect(path).toBe("company-123/analysis-456/desktop-screenshot.png");
    });

    it("rejects paths that escape the root", () => {
      expect(() =>
        artifactService.buildArtifactPath(
          "company-123",
          "analysis-456",
          "../../../etc/passwd",
        ),
      ).toThrow("escapes the configured root");
    });
  });

  describe("writeArtifact", () => {
    it("writes a file and returns the relative path", async () => {
      const path = await artifactService.writeArtifact(
        "company-123",
        "analysis-456",
        "test.txt",
        "hello world",
      );

      expect(path).toBe("company-123/analysis-456/test.txt");

      const content = await readFile(
        join(TEST_ARTIFACT_ROOT, path),
        "utf-8",
      );
      expect(content).toBe("hello world");
    });
  });

  describe("writeScreenshot", () => {
    it("writes a screenshot with viewport name", async () => {
      const screenshot = Buffer.from("fake-screenshot-data");
      const path = await artifactService.writeScreenshot(
        "company-123",
        "analysis-456",
        "desktop",
        screenshot,
      );

      expect(path).toBe(
        "company-123/analysis-456/desktop-screenshot.png",
      );

      const content = await readFile(join(TEST_ARTIFACT_ROOT, path));
      expect(content).toEqual(screenshot);
    });
  });

  describe("writeRenderedHtml", () => {
    it("writes rendered HTML", async () => {
      const html = "<html><body>Test</body></html>";
      const path = await artifactService.writeRenderedHtml(
        "company-123",
        "analysis-456",
        html,
      );

      expect(path).toBe("company-123/analysis-456/rendered.html");

      const content = await readFile(join(TEST_ARTIFACT_ROOT, path), "utf-8");
      expect(content).toBe(html);
    });
  });

  describe("writeAuditReport", () => {
    it("writes audit report as JSON", async () => {
      const report = JSON.stringify({ score: 85 });
      const path = await artifactService.writeAuditReport(
        "company-123",
        "analysis-456",
        report,
      );

      expect(path).toBe("company-123/analysis-456/audit-report.json");

      const content = await readFile(join(TEST_ARTIFACT_ROOT, path), "utf-8");
      expect(content).toBe(report);
    });
  });
});
