import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const start = new Date("2026-10-29T12:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await page.goto("/test/clock.html");
  await expect(page.getByLabel("Match clock, 00:10 remaining")).toBeVisible();
});

test("the mounted header counts down while idle and stays at zero after expiry", async ({ page }) => {
  await page.clock.runFor(2000);
  await expect(page.getByLabel(/Match clock/)).toHaveText("00:08");

  await page.clock.runFor(10_000);
  await expect(page.getByLabel(/Match clock/)).toHaveText("00:00");
  await page.clock.runFor(2000);
  await expect(page.getByLabel(/Match clock/)).toHaveText("00:00");
});

test("a fresh server sample corrects the mounted clock after reconnect", async ({ page }) => {
  await page.clock.runFor(2000);
  await expect(page.getByLabel(/Match clock/)).toHaveText("00:08");

  await page.evaluate(() => {
    const fixture = window as typeof window & { clockHarness: { sample: (remainingMs: number) => void } };
    fixture.clockHarness.sample(20_000);
  });
  await expect(page.getByLabel(/Match clock/)).toHaveText("00:20");
  await page.clock.runFor(1000);
  await expect(page.getByLabel(/Match clock/)).toHaveText("00:19");
});

test("background return accounts for all elapsed time instead of one timer tick", async ({ page }) => {
  // Due timers run at most once, as when a backgrounded page resumes.
  await page.clock.fastForward(8000);
  await expect(page.getByLabel(/Match clock/)).toHaveText("00:02");
  await page.clock.fastForward(5000);
  await expect(page.getByLabel(/Match clock/)).toHaveText("00:00");
});
