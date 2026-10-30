import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    teamChatHarness: {
      sent: string[];
      settle(index: number, error?: string): Promise<void>;
    };
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/test/team-chat.html");
  await expect(page.getByRole("textbox", { name: "Team message" })).toBeEnabled();
});

test("a delayed send acknowledgement preserves a newer draft", async ({ page }) => {
  const draft = page.getByRole("textbox", { name: "Team message" });
  await draft.fill("first message");
  await page.getByRole("button", { name: "Send team message" }).click();
  await expect.poll(() => page.evaluate(() => window.teamChatHarness.sent)).toEqual(["first message"]);

  await draft.fill("next message still being written");
  await expect(draft).toHaveValue("next message still being written");
  await page.evaluate(() => window.teamChatHarness.settle(0));

  await expect(draft).toHaveValue("next message still being written");
});

test("successful acknowledgement clears an unchanged draft and sends trimmed text", async ({ page }) => {
  const draft = page.getByRole("textbox", { name: "Team message" });
  await draft.fill("  first message  ");
  await page.getByRole("button", { name: "Send team message" }).click();
  await expect(draft).toHaveValue("  first message  ");
  expect(await page.evaluate(() => window.teamChatHarness.sent)).toEqual(["first message"]);

  await page.evaluate(() => window.teamChatHarness.settle(0));
  await expect(draft).toHaveValue("");
  await expect(page.getByRole("button", { name: "Send team message" })).toBeDisabled();
});

test("an edit back to the sent text is still a newer draft", async ({ page }) => {
  const draft = page.getByRole("textbox", { name: "Team message" });
  await draft.fill("same words");
  await page.getByRole("button", { name: "Send team message" }).click();
  await draft.fill("different words");
  await draft.fill("same words");

  await page.evaluate(() => window.teamChatHarness.settle(0));
  await expect(draft).toHaveValue("same words");
});

for (const edited of [false, true]) {
  test(`a rejected send preserves the ${edited ? "newer" : "original"} draft`, async ({ page }) => {
    const draft = page.getByRole("textbox", { name: "Team message" });
    await draft.fill("first message");
    await page.getByRole("button", { name: "Send team message" }).click();
    const expected = edited ? "next message" : "first message";
    if (edited) await draft.fill(expected);

    await page.evaluate(() => window.teamChatHarness.settle(0, "confirmation lost"));
    await expect(page.getByRole("alert")).toHaveText("confirmation lost");
    await expect(draft).toHaveValue(expected);
    await expect(page.getByRole("button", { name: "Send team message" })).toBeEnabled();
  });
}

test("each of two pending sends clears only its own unchanged draft", async ({ page }) => {
  const draft = page.getByRole("textbox", { name: "Team message" });
  const send = page.getByRole("button", { name: "Send team message" });
  await draft.fill("first message");
  await send.click();
  await draft.fill("second message");
  await send.click();
  expect(await page.evaluate(() => window.teamChatHarness.sent)).toEqual(["first message", "second message"]);

  await page.evaluate(() => window.teamChatHarness.settle(0));
  await expect(draft).toHaveValue("second message");
  await page.evaluate(() => window.teamChatHarness.settle(1));
  await expect(draft).toHaveValue("");
});

test("an older send finishing last preserves text typed after a newer send succeeds", async ({ page }) => {
  const draft = page.getByRole("textbox", { name: "Team message" });
  const send = page.getByRole("button", { name: "Send team message" });
  await draft.fill("first message");
  await send.click();
  await draft.fill("second message");
  await send.click();

  await page.evaluate(() => window.teamChatHarness.settle(1));
  await expect(draft).toHaveValue("");
  await draft.fill("third message in progress");
  await page.evaluate(() => window.teamChatHarness.settle(0));
  await expect(draft).toHaveValue("third message in progress");
});

test("fallback chat still appends the sent message and clears its draft", async ({ page }) => {
  await page.goto("/test/team-chat.html?fallback=1");
  const draft = page.getByRole("textbox", { name: "Team message" });
  await draft.fill("  mock message  ");
  await page.getByRole("button", { name: "Send team message" }).click();

  await expect(page.getByRole("listitem")).toHaveText("You: mock message");
  await expect(draft).toHaveValue("");
});
