import { Injectable, Logger } from "@nestjs/common";
import { mkdir, writeFile } from "fs/promises";
import { resolve } from "path";

/**
 * The artifact service manages storage of analysis artifacts
 * (screenshots, HTML, audit reports) in the configured artifact root.
 */
@Injectable()
export class ArtifactService {
  private readonly logger = new Logger(ArtifactService.name);
  private readonly artifactRoot: string;

  constructor(artifactRoot: string = "./analysis-artifacts") {
    this.artifactRoot = resolve(artifactRoot);
  }

  /**
   * Ensures the artifact root directory exists.
   */
  async ensureArtifactRoot(): Promise<void> {
    await mkdir(this.artifactRoot, { recursive: true });
  }

  /**
   * Builds the path for an artifact, ensuring it's within the root.
   */
  buildArtifactPath(
    companyId: string,
    analysisId: string,
    filename: string,
  ): string {
    const relativePath = `${companyId}/${analysisId}/${filename}`;
    const absolutePath = resolve(this.artifactRoot, relativePath);

    // Security check: ensure the path is within the artifact root
    if (!absolutePath.startsWith(this.artifactRoot)) {
      throw new Error(
        `Artifact path "${relativePath}" escapes the configured root "${this.artifactRoot}".`,
      );
    }

    return relativePath;
  }

  /**
   * Writes an artifact to the filesystem.
   */
  async writeArtifact(
    companyId: string,
    analysisId: string,
    filename: string,
    content: string | Buffer,
  ): Promise<string> {
    const relativePath = this.buildArtifactPath(companyId, analysisId, filename);
    const absolutePath = resolve(this.artifactRoot, relativePath);

    // Ensure the directory exists
    await mkdir(`${this.artifactRoot}/${companyId}/${analysisId}`, {
      recursive: true,
    });

    await writeFile(absolutePath, content, "utf-8");

    this.logger.log(`Wrote artifact: ${relativePath}`);
    return relativePath;
  }

  /**
   * Writes a screenshot artifact.
   */
  async writeScreenshot(
    companyId: string,
    analysisId: string,
    viewport: string,
    screenshot: Buffer,
  ): Promise<string> {
    return this.writeArtifact(
      companyId,
      analysisId,
      `${viewport}-screenshot.png`,
      screenshot,
    );
  }

  /**
   * Writes the rendered HTML artifact.
   */
  async writeRenderedHtml(
    companyId: string,
    analysisId: string,
    html: string,
  ): Promise<string> {
    return this.writeArtifact(
      companyId,
      analysisId,
      "rendered.html",
      html,
    );
  }

  /**
   * Writes an audit report artifact.
   */
  async writeAuditReport(
    companyId: string,
    analysisId: string,
    report: string,
  ): Promise<string> {
    return this.writeArtifact(
      companyId,
      analysisId,
      "audit-report.json",
      report,
    );
  }
}
