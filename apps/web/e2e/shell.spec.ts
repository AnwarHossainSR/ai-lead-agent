import { expect, test } from "@playwright/test";

test.describe("Shell renders", () => {
  test("shows MELA branding in header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("MELA").first()).toBeVisible();
  });

  test("shows navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leads" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Companies" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Outreach Review" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Analytics" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Operations" })).toBeVisible();
  });

  test("shows dashboard heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Dashboard");
  });
});

test.describe("Workspace navigation", () => {
  test("reaches the leads, companies, outreach review, analytics and operations views", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Leads" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Leads");

    await page.getByRole("link", { name: "Companies" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Companies");

    await page.getByRole("link", { name: "Outreach Review" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Outreach Review");

    await page.getByRole("link", { name: "Analytics" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Analytics");

    await page.getByRole("link", { name: "Operations" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Operations");
  });
});

test.describe("API status page", () => {
  test("is reachable from the header and shows its section", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "API Status" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("API Status");
    await expect(page.getByText("API", { exact: true })).toBeVisible();
  });

  test("shows a status badge (healthy or degraded)", async ({ page }) => {
    await page.goto("/api-status");
    const badge = page.locator("span").filter({ hasText: /Healthy|Degraded|Unreachable/ });
    await expect(badge).toBeVisible();
  });
});
