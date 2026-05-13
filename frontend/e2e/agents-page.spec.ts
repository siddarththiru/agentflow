import { test, expect } from "@playwright/test";

test("agents route is reachable from shell", async ({ page }) => {
  await page.goto("/agents");

  await expect(page.getByText("AgentFlow", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/agents/);
});
