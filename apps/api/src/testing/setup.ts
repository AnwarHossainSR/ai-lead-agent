import "reflect-metadata";

import { hydrateEnvironment } from "@mela/config/env";

// Vitest starts each test file with the package directory as its working
// directory, so the repository-root `.env` — the file Docker Compose reads to
// decide which ports the containers are published on — has to be found by
// walking up. In CI there is no file and the variables come from the
// environment itself, which `hydrateEnvironment` leaves alone.
//
// The AI env vars are required by the validated schema but not relevant to
// most API tests. Set placeholder values so `loadApiEnv()` passes validation
// without needing real keys. Real API calls are tested in `@mela/ai` using
// the FakeAIProvider — no test in this package hits a vendor.
if (!process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = "test-gemini-key-not-real";
}
if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
  process.env.CLOUDFLARE_ACCOUNT_ID = "test-cf-account-id";
}
if (!process.env.CLOUDFLARE_API_TOKEN) {
  process.env.CLOUDFLARE_API_TOKEN = "test-cf-api-token-not-real";
}
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = "test-session-secret-not-real-0123456789";
}

hydrateEnvironment();
