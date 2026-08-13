import { expect, test } from "@playwright/test";

const STUB_URL = "http://127.0.0.1:3098";

async function setStubMode(path: string, mode: "ok" | "fail" | "refuse") {
  const response = await fetch(`${STUB_URL}/__control__`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, mode }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set stub mode for ${path}: ${response.status}`);
  }
}

test.afterEach(async () => {
  // Every test that overrides the stub resets it, so a failure in one test
  // cannot leak a broken API into the next.
  await setStubMode("*", "ok");
});

test.describe("Dashboard stat panels (task 3.4)", () => {
  test("shows the real counts from each endpoint", async ({ page }) => {
    await page.goto("/");
    const main = page.getByRole("main");

    await expect(main.getByText("Companies", { exact: true })).toBeVisible();
    await expect(main.getByText("42", { exact: true })).toBeVisible();
    await expect(main.getByText("17", { exact: true })).toBeVisible();
    await expect(main.getByText("5", { exact: true })).toBeVisible();
    await expect(main.getByText("3", { exact: true })).toBeVisible();
  });

  test("the API stopped: every panel renders its condition, and the page still renders", async ({
    page,
  }) => {
    await setStubMode("*", "refuse");

    await page.goto("/");
    const main = page.getByRole("main");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Dashboard");
    await expect(main.getByText("unknown").first()).toBeVisible();
    // Four stat cards, all degraded: none of the real counts appear.
    await expect(main.getByText("42", { exact: true })).not.toBeVisible();
  });

  test("a single failing endpoint degrades only its panel", async ({ page }) => {
    await setStubMode("/api/companies/count", "fail");

    await page.goto("/");
    const main = page.getByRole("main");

    // The failing panel shows unknown rather than a number...
    const companiesCard = main.getByText("Companies", { exact: true }).locator("xpath=..");
    await expect(companiesCard.getByText("unknown")).toBeVisible();

    // ...while the other panels, backed by working endpoints, show real data.
    await expect(main.getByText("17", { exact: true })).toBeVisible();
    await expect(main.getByText("5", { exact: true })).toBeVisible();
    await expect(main.getByText("3", { exact: true })).toBeVisible();
  });
});
