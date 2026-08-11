import { test, expect } from "@playwright/test";

test.describe("Shell renders", () => {
  test("shows MELA branding in header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("MELA").first()).toBeVisible();
  });

  test("shows navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Dashboard")).toBeVisible();
    await expect(page.getByText("Companies")).toBeVisible();
    await expect(page.getByText("Contacts")).toBeVisible();
    await expect(page.getByText("Leads")).toBeVisible();
    await expect(page.getByText("Outreach")).toBeVisible();
  });

  test("shows dashboard heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Dashboard");
  });
});

test.describe("API status display", () => {
  test("shows API status section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("API Status")).toBeVisible();
  });

  test("shows status badge (healthy or degraded)", async ({ page }) => {
    await page.goto("/");
    const badge = page.locator("span").filter({ hasText: /Healthy|Degraded|Unreachable/ });
    await expect(badge).toBeVisible();
  });
});
