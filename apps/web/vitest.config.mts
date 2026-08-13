import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // The Next.js tsconfig sets `jsx: "preserve"` for the Next compiler, and
  // Vite's oxc transform otherwise inherits that from tsconfig. Override it
  // explicitly so test files compile with the automatic JSX runtime.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
    setupFiles: ["./src/testing/setup.ts"],
  },
});
