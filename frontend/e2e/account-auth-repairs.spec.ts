import { expect, test, type Page } from "@playwright/test";

test.setTimeout(15000);
const WEB = process.env.E2E_ACCOUNT_WEB_URL ?? "http://127.0.0.1:18475";
function profile(username: string) { return { id: username, username, email: `${username}@example.test`, displayName: username, firstName: null, lastName: null, bio: null, avatarUrl: null, coverUrl: null, role: "USER", hasPassword: true, hasDiscord: false, hasGithub: false, emailVerifiedAt: null }; }
async function fixture(page: Page) {
  let identity = "account-a";
  let token = "access-a";
  let hold = false;
  let release!: () => void;
  const held = new Promise<void>((done) => { release = done; });
  await page.route("**/api/**", (route) => route.fulfill({ json: { users: [] } }));
  await page.route("**/api/social/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/auth/refresh", (route) => route.fulfill({ json: { accessToken: token } }));
  await page.route("**/api/accounts/me", async (route) => {
    if (route.request().method() !== "GET") return route.fulfill({ status: 401, json: { error: "expired" } });
    if (hold) await held;
    return route.fulfill({ json: profile(identity) });
  });
  await page.goto(`${WEB}/account`);
  await expect(page.locator(".signed-in-as")).toHaveText("@account-a");
  return { replace: () => { identity = "account-b"; token = "access-b"; hold = true; }, release };
}
test("Account follows sign-in from another tab and cannot keep the old profile", async ({ page }) => {
  const harness = await fixture(page);
  harness.replace();
  await page.evaluate(() => { const channel = new BroadcastChannel("fieldnote-auth-session"); channel.postMessage("signed-in"); channel.close(); });
  await expect(page.locator(".signed-in-as")).toHaveCount(0);
  harness.release();
  await expect(page.locator(".signed-in-as")).toHaveText("@account-b", { timeout: 3000 });
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
});
test("Account retains the session and does not replay a profile write after renewal", async ({ page }) => {
  await fixture(page);
  let posts = 0;
  let refreshes = 0;
  await page.route("**/api/auth/refresh", (route) => { refreshes++; return route.fulfill({ json: { accessToken: "access-renewed" } }); });
  await page.route("**/api/accounts/me", (route) => {
    if (route.request().method() === "PATCH") { posts++; return route.fulfill({ status: 401, json: { error: "expired" } }); }
    return route.fulfill({ json: profile("account-a") });
  });
  await page.getByLabel("Display name", { exact: true }).fill("edited display");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect.poll(() => refreshes).toBe(1);
  await expect(page.getByRole("alert").first()).toBeVisible();
  expect(posts).toBe(1);
  await expect(page.locator(".signed-in-as")).toHaveText("@account-a");
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
});

test("Account shows replacement verification outage and retries the new identity", async ({ page }) => {
  const harness = await fixture(page);
  harness.replace();
  await page.route("**/api/accounts/me", (route) => route.fulfill({ status: 503, json: { error: "unavailable" } }));
  await page.evaluate(() => { const channel = new BroadcastChannel("fieldnote-auth-session"); channel.postMessage("signed-in"); channel.close(); });
  await expect(page.getByRole("heading", { name: "We couldn’t load your account." })).toBeVisible({ timeout: 3000 });
  await expect(page.locator(".signed-in-as")).toHaveCount(0);
  await page.route("**/api/accounts/me", (route) => route.fulfill({ json: profile("account-b") }));
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".signed-in-as")).toHaveText("@account-b");
});

test("same-user renewal preserves saved profile changes until a fresh profile arrives", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/accounts/me", (route) => route.fulfill({ json: { ...profile("account-a"), displayName: "saved display" } }));
  await page.getByLabel("Display name", { exact: true }).fill("saved display");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "saved display", exact: true })).toBeVisible();
  let renewals = 0;
  await page.route("**/api/auth/refresh", (route) => { renewals++; return route.fulfill({ json: { accessToken: "renewed-access" } }); });
  await page.route("**/api/social/friendships", (route) => route.fulfill({ status: 401, json: { error: "expired" } }));
  await page.getByRole("button", { name: "Refresh lists", exact: true }).click();
  await expect.poll(() => renewals).toBe(1);
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "saved display", exact: true })).toBeVisible({ timeout: 3000 });
  await page.route("**/api/accounts/me", (route) => route.fulfill({ json: { ...profile("account-a"), displayName: "fresh verified profile" } }));
  await page.evaluate(() => { const channel = new BroadcastChannel("fieldnote-auth-session"); channel.postMessage("token-renewed"); channel.close(); });
  await expect(page.getByRole("heading", { name: "fresh verified profile", exact: true })).toBeVisible();
});
