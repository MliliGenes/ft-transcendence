import { expect, test } from "@playwright/test";

const WEB = process.env.E2E_WEB_URL ?? "http://localhost:4173";

test("mock mode changes its Arena snapshot before another game action", async ({ page }) => {
  await page.goto(WEB);
  const mode = page.getByRole("button", { name: "2v2", exact: true });
  await mode.click();
  await expect(mode).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("header")).toContainText("2v2");
  await page.getByRole("button", { name: "Start round", exact: true }).click();
  await expect(page.getByLabel("Teams", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "1v1", exact: true }).click();
  await expect(page.locator("header")).toContainText("1v1");
  await expect(page.getByRole("button", { name: "Start round", exact: true })).toBeVisible();
  await expect(page.getByLabel("Teams", { exact: true })).toHaveCount(0);
});
