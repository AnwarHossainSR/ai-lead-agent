import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    // Vitest transforms TypeScript with esbuild, which does not implement
    // `emitDecoratorMetadata`. Nest reads that metadata to discover what a
    // constructor asks for, so without this every provider fails to resolve
    // with "Nest can't resolve dependencies" — in the tests only, which is the
    // worst possible place to discover it. SWC does implement it.
    swc.vite({
      module: { type: "es6" },
      jsc: {
        target: "es2023",
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/testing/setup.ts"],
    // The health tests start a real HTTP server and talk to the real
    // PostgreSQL and Redis containers, so they cannot run concurrently.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
