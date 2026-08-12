import { Injectable, Logger } from "@nestjs/common";
import type { Browser, BrowserContext, Page } from "playwright";

import { type PageCapture } from "./observation-rules";

/**
 * The browser capture service manages Playwright browser lifecycle
 * and page capture for website analysis.
 *
 * The browser is lazily launched and shared across analyses.
 * Each analysis gets its own context, disposed in a finally block.
 */
@Injectable()
export class BrowserCaptureService {
  private readonly logger = new Logger(BrowserCaptureService.name);
  private browser: Browser | null = null;

  /**
   * Lazily launches the shared browser instance.
   */
  async ensureBrowser(): Promise<Browser> {
    if (this.browser !== null && this.browser.isConnected()) {
      return this.browser;
    }

    this.logger.log("Launching shared browser instance");

    const { chromium } = await import("playwright");
    this.browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    return this.browser;
  }

  /**
   * Captures a page at a specific viewport size.
   */
  async capturePage(
    url: string,
    viewport: { width: number; height: number },
    options: {
      navigationTimeoutMs?: number;
      maxPageBytes?: number;
      userAgent?: string;
    } = {},
  ): Promise<PageCapture> {
    const {
      navigationTimeoutMs = 30_000,
      maxPageBytes = 10 * 1024 * 1024,
      userAgent = "MelaBot/1.0",
    } = options;

    const browser = await this.ensureBrowser();
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      context = await browser.newContext({
        viewport,
        userAgent,
        ignoreHTTPSErrors: true,
      });

      page = await context.newPage();

      // Track console messages
      const consoleMessages: Array<{ type: string; text: string }> = [];
      page.on("console", (msg: { type: () => string; text: () => string }) => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });

      // Track failed requests
      const failedRequests: Array<{ url: string; error: string }> = [];
      page.on("requestfailed", (request: { url: () => string; failure: () => { errorText: string } | null }) => {
        failedRequests.push({
          url: request.url(),
          error: request.failure()?.errorText ?? "unknown",
        });
      });

      // Track redirect chain
      const _redirectChain: string[] = [];
      page.on("response", (response: { url: () => string; request: () => { isNavigationRequest: () => boolean }; headers: () => Record<string, string> }) => {
        const request = response.request();
        if (request.isNavigationRequest()) {
          const headers = response.headers();
          if (headers.location) {
            _redirectChain.push(response.url());
          }
        }
      });

      // Navigate to the page
      const response = await page.goto(url, {
        waitUntil: "load",
        timeout: navigationTimeoutMs,
      });

      // Get page content
      const html = await page.content();
      const htmlBytes = new TextEncoder().encode(html).length;

      // Check page weight
      if (htmlBytes > maxPageBytes) {
        throw new Error(`Page weight (${htmlBytes} bytes) exceeds maximum (${maxPageBytes} bytes)`);
      }

      // Get response headers
      const responseHeaders: Record<string, string> = {};
      if (response) {
        const headers = response.headers();
        for (const [key, value] of Object.entries(headers)) {
          responseHeaders[key] = value;
        }
      }

      return {
        url: page.url(),
        status: response?.status() ?? 0,
        headers: responseHeaders,
        html,
        consoleMessages,
        failedRequests,
        transferSize: htmlBytes,
      };
    } finally {
      if (page !== null) {
        await page.close().catch(() => {});
      }
      if (context !== null) {
        await context.close().catch(() => {});
      }
    }
  }

  /**
   * Captures a page at both desktop and mobile viewports.
   */
  async captureAtBothViewports(
    url: string,
    options: {
      navigationTimeoutMs?: number;
      maxPageBytes?: number;
      userAgent?: string;
    } = {},
  ): Promise<{
    desktop: PageCapture;
    mobile: PageCapture;
  }> {
    const desktop = await this.capturePage(
      url,
      { width: 1920, height: 1080 },
      options,
    );

    const mobile = await this.capturePage(
      url,
      { width: 375, height: 812 },
      options,
    );

    return { desktop, mobile };
  }

  /**
   * Gracefully closes the shared browser instance.
   */
  async onApplicationShutdown(): Promise<void> {
    if (this.browser !== null) {
      this.logger.log("Closing shared browser instance");
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}
