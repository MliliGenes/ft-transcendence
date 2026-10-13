import { expect, test } from "@playwright/test";

const WEB = process.env.E2E_WEB_URL ?? "http://localhost:4173";

// Auth → Game wiring: /play/ is live only (no ?user=, no ?live=, no mock).
// The session comes from the shared browser-auth client (refresh cookie +
// /accounts/me); game HTTP carries Bearer and sockets carry accessToken.

test("unauthenticated /play/ asks to sign in instead of mocking", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/auth/refresh", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Expired" }) }),
  );
  await page.goto(`${WEB}/play/`);
  await expect(page.getByText(/sign in/i).first()).toBeVisible();
  // No mock playground controls leak into the prod path.
  await expect(page.getByRole("group", { name: /mode \(mock\)/i })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("authenticated /play/ sends Bearer to game HTTP and goes live without query identity", async ({ page }) => {
  const seenAuth: Array<string | null> = [];
  await page.route("**/auth/refresh", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ accessToken: "e2e-access" }) }),
  );
  await page.route("**/accounts/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "e2e-a", username: "e2e-a" }),
    }),
  );
  await page.route("**/matches/*/snapshot", (route) => {
    seenAuth.push(route.request().headers()["authorization"] ?? null);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "1v1",
        roundPhase: "CODING",
        round: 1,
        totalRounds: 1,
        remainingMs: 60_000,
        problem: { id: "p1", title: "T", description: "", examples: [] },
        tests: [],
        mySide: "left",
        sides: {
          left: { status: "coding", submissions: 0, presence: "online" },
          right: { status: "coding", submissions: 0, presence: "online" },
        },
        reveal: null,
        revision: 1,
        pendingEvaluation: false,
        final: null,
      }),
    });
  });
  // No game server behind the socket: the page must fail gracefully, after
  // proving the HTTP baseline carried the session token.
  await page.goto(`${WEB}/play/?match=match-1`);
  await page.waitForTimeout(3000);
  const bearer = seenAuth.filter((v) => v === "Bearer e2e-access");
  expect(bearer.length).toBeGreaterThan(0);
  // Query identity is never trusted on the wire: no user id leaks into URLs.
  expect(page.url()).not.toMatch(/[?&]user=/);
});
