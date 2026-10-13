import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { CollabClient } from "../src/arena/collab.js";

const GAME = process.env.E2E_GAME_URL ?? "http://localhost:3220";
const WEB = process.env.E2E_WEB_URL ?? "http://localhost:4173";
const user = "repair-browser-left";

async function createMatch(request: APIRequestContext, mode: "1v1" | "2v2"): Promise<string> {
  const participants = [{ userId: user, sideId: "left" }, { userId: "repair-browser-right", sideId: "right" }];
  if (mode === "2v2") participants.push(
    { userId: "repair-browser-left-mate", sideId: "left" },
    { userId: "repair-browser-right-mate", sideId: "right" },
  );
  const response = await request.post(`${GAME}/matches`, {
    headers: { "x-dev-user-id": user },
    data: { mode, participants, problemVersionIds: ["even-ledger"] },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).matchId as string;
}

async function sharedSource(page: Page): Promise<string | undefined> {
  return page.evaluate(() => (window as unknown as { __arenaCollab?: CollabClient }).__arenaCollab?.getSource());
}

test("rejected shared input restores the saved document and keeps a manual recovery copy", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const matchId = await createMatch(request, "2v2");
  await page.goto(`${WEB}/?live=1&user=${user}&match=${matchId}`);
  await page.getByRole("button", { name: "Start round" }).click();
  const editor = page.getByLabel(/Solution editor/);
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await expect(page.getByText(/Shared doc r\d+ · live/)).toBeVisible();
  const baseline = await sharedSource(page);
  expect(baseline).toBeTruthy();

  // One real input exceeds the gateway's frame limit and receives a rejection.
  const rejectedText = "\n# recovery-marker\n" + "x".repeat(210_000);
  await editor.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+End" : "Control+End");
  await page.keyboard.insertText(rejectedText);
  const recovery = page.getByLabel("Recovery text");
  await expect(recovery).toBeVisible();
  const savedCopy = await recovery.inputValue();
  expect(savedCopy).toContain(rejectedText);
  expect(savedCopy.length).toBe(baseline!.length + rejectedText.length);
  await expect.poll(() => sharedSource(page)).toBe(baseline);
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await expect(page.getByRole("button", { name: "Run", exact: true })).toBeDisabled();
  await expect(page.getByLabel("You are ready")).toBeDisabled();

  await page.reload();
  await expect(recovery).toHaveValue(savedCopy);
  await expect.poll(() => sharedSource(page)).toBe(baseline);
  await page.getByRole("button", { name: "Dismiss recovery copy" }).click();
  await expect(recovery).toHaveCount(0);
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await expect(page.getByLabel("You are ready")).toBeEnabled();
  await page.getByLabel("Language").selectOption("C++");
  await expect(page.getByLabel("You are ready")).toBeEnabled();
  await expect.poll(() => page.evaluate(() => {
    const client = (window as unknown as { __arenaCollab?: CollabClient }).__arenaCollab;
    return client?.language;
  })).toBe("C++");
  expect(await sharedSource(page)).not.toBe(baseline);
  expect(errors).toEqual([]);
});

test("a confirmed command stays accepted while refresh is unavailable", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const matchId = await createMatch(request, "1v1");
  await page.goto(`${WEB}/?live=1&user=${user}&match=${matchId}`);
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  await page.route("**/snapshot", (route) => route.abort());
  await page.route("**/socket.io/**", (route) => route.abort());
  let leaveRequests = 0;
  page.on("request", (req) => { if (req.url().endsWith("/leave")) leaveRequests++; });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Leave match" }).click();
  await expect(page.getByText(/Action accepted; state refresh failed/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave match" })).toBeDisabled();
  const savedState = await request.get(`${GAME}/matches/${matchId}/snapshot`, { headers: { "x-dev-user-id": user } });
  expect((await savedState.json()).roundPhase).toBe("MATCH_COMPLETE");
  await page.unroute("**/snapshot");
  await page.unroute("**/socket.io/**");
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  await expect(page.getByText(/Action accepted; state refresh failed/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Leave match" })).toHaveCount(0);
  expect(leaveRequests).toBe(1);
  expect(errors).toEqual([]);
});
