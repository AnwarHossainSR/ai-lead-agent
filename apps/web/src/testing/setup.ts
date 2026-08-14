import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

import "@testing-library/jest-dom/vitest";
import type { AxeMatchers } from "vitest-axe";
// The package's shallow "vitest-axe/matchers" re-export is typed `export
// type`, so it cannot be imported as a value; the deep path carries the real
// declaration.
import { toHaveNoViolations } from "vitest-axe/dist/matchers.js";

expect.extend({ toHaveNoViolations });

declare module "vitest" {
  // Matches vitest's own `Assertion<T = any>` default exactly — a mismatched
  // default here is a declaration-merging error, not a lint concern.
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}

afterEach(cleanup);
