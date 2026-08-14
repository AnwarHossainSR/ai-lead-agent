import { configureAxe } from "vitest-axe";

/**
 * Task 9.1's "configured level": WCAG 2.1 A and AA. Every accessibility test
 * in this project calls through here so the level is set in one place rather
 * than repeated — and drifting — per test file.
 */
export const axe = configureAxe({
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  },
});
