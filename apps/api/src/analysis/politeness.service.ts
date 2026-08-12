import { Injectable, Logger } from "@nestjs/common";
import { RobotsService, detectBlock, type BlockVerdict } from "../http";

/**
 * The politeness service integrates robots.txt checking and block detection
 * with the analysis pipeline.
 */
@Injectable()
export class PolitenessService {
  private readonly logger = new Logger(PolitenessService.name);

  constructor(private readonly robotsService: RobotsService) {}

  /**
   * Checks if a path is allowed by robots.txt.
   */
  async isPathAllowed(url: string, userAgent: string): Promise<boolean> {
    try {
      const parsedUrl = new URL(url);
      const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;
      const policy = await this.robotsService.policyFor(origin);
      return policy.allows(parsedUrl.pathname, userAgent);
    } catch (error) {
      this.logger.warn(`Failed to check robots.txt for ${url}: ${error}`);
      return false;
    }
  }

  /**
   * Gets the crawl delay for a host.
   */
  async getCrawlDelay(url: string, userAgent: string): Promise<number | null> {
    try {
      const parsedUrl = new URL(url);
      const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;
      const policy = await this.robotsService.policyFor(origin);
      return policy.crawlDelaySeconds(userAgent);
    } catch (error) {
      this.logger.warn(`Failed to get crawl delay for ${url}: ${error}`);
      return null;
    }
  }

  /**
   * Detects if a response indicates the host is blocking us.
   */
  detectBlock(
    status: number,
    headers: Record<string, string>,
    body: string,
  ): BlockVerdict {
    return detectBlock(status, headers, body);
  }
}
