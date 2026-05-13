import { test, expect } from "@playwright/test";

test("dashboard route loads and shows AgentFlow shell", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByText("AgentFlow", { exact: true })).toBeVisible();
  await expect(page.getByText("Operations console")).toBeVisible();
});
