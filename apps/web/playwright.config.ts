import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev --port 3001",
    port: 3001,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
