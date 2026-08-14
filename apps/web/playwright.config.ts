import { defineConfig } from "@playwright/test";

const API_STUB_URL = "http://127.0.0.1:3098";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:4000",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "node e2e/fixtures/api-stub-server.mjs",
      url: `${API_STUB_URL}/__ready__`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "pnpm dev --port 4000",
      port: 4000,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        API_URL: API_STUB_URL,
      },
    },
  ],
});
