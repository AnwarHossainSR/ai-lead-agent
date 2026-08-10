import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests share one PostgreSQL database and truncate between
    // cases, so they cannot run concurrently with each other.
    fileParallelism: false,
    // A cold Docker volume makes the first connection slow.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
