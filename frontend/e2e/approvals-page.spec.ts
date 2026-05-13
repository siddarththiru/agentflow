import { test, expect } from "@playwright/test";

test("approvals route is reachable from shell", async ({ page }) => {
  await page.goto("/approvals");

  await expect(page.getByText("AgentFlow", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/approvals/);
});
