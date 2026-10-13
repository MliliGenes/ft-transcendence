import { expect, test, type Page } from "@playwright/test";

const WEB = process.env.E2E_WEB_URL ?? "http://localhost:4173";
async function signal(page: Page, message: string) {
  await page.evaluate((value) => { const channel = new BroadcastChannel("fieldnote-auth-session"); channel.postMessage(value); channel.close(); }, message);
}
async function fixture(page: Page, initialId = "user-a", nearExpiry = false) {

  let identity = initialId;
  let token = nearExpiry ? `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ exp: Math.floor((Date.now() + 5000) / 1000) })).toString("base64url")}.sig` : "access-a";
  const sockets: Array<{ identity: string; closed: boolean; rooms: string[] }> = [];
  let activeReads = 0;
  let matchReads = 0;
  await page.route("**/auth/refresh", (route) => route.fulfill({ json: { accessToken: token } }));
  await page.route("**/accounts/me", (route) => {
    if (route.request().headers().authorization !== `Bearer ${token}`) return route.fulfill({ status: 401, json: { error: "expired" } });
    return route.fulfill({ json: { id: identity, username: identity } });
  });
  await page.route("**/lobby/active", (route) => {
    activeReads++;
    return route.fulfill({ json: { queue: null, room: {
      room: { id: `room-${identity}`, code: identity === "user-a" ? "AAAAAA" : "BBBBBB", mode: "1v1", ownerUserId: identity, status: "open", createdAt: 1, expiresAt: 10000, matchId: null },
      members: [{ roomId: `room-${identity}`, userId: identity, sideId: "left", ready: false, joinedAt: 1 }],
    } } });
  });
  await page.route("**/matches/*/snapshot", (route) => { matchReads++; return route.fulfill({ json: {
    mode: "1v1", roundPhase: "MATCH_FOUND", round: 1, totalRounds: 1, remainingMs: 60000,
    problem: { id: "p1", title: "T", description: "", examples: [], starters: { Python: "" } },
    tests: [], mySide: "left", sides: { left: { status: "coding", submissions: 0, presence: "online" }, right: { status: "coding", submissions: 0, presence: "online" } }, reveal: null, revision: 1, pendingEvaluation: false, final: null,
  } }); });
  await page.routeWebSocket("**/socket.io/**", (socket) => {
    const record = { identity, closed: false, rooms: [] as string[] }; sockets.push(record);
    socket.onClose(() => { record.closed = true; });
    socket.send('0{"sid":"fixture","upgrades":[],"pingInterval":25000,"pingTimeout":20000}');
    socket.onMessage((data) => {
      const value = String(data);
      if (value.startsWith("40/lobby")) socket.send('40/lobby,{"sid":"lobby-fixture"}');
      else if (value.startsWith("40")) {
        socket.send('40{"sid":"match-fixture"}');
        socket.send('42' + JSON.stringify(["snapshot", {
          mode: "1v1", roundPhase: "MATCH_FOUND", round: 1, totalRounds: 1, remainingMs: 60000,
          problem: { id: "p1", title: "T", description: "", examples: [], starters: { Python: "" } }, tests: [], mySide: "left", sides: { left: { status: "coding", submissions: 0, presence: "online" }, right: { status: "coding", submissions: 0, presence: "online" } }, reveal: null, revision: 1, pendingEvaluation: false, final: null,
        }]));
      } else if (value.startsWith("42/lobby,")) {
        const [event, payload] = JSON.parse(value.slice(9));
        if (event === "lobby:join_room") record.rooms.push(payload.roomId);
      }
    });
  });
  return { sockets, matchReads: () => matchReads, reads: () => activeReads, setIdentity: (value: string) => { identity = value; token = `access-${value}`; }, rotate: () => { token = "access-rotated"; } };
}

test("Play consumes remote sign-in and replaces Lobby identity and room state", async ({ page }) => {
  const harness = await fixture(page);
  await page.goto(`${WEB}/play/`);
  await expect(page.getByText("AAAAAA", { exact: true })).toBeVisible();
  harness.setIdentity("user-b");
  await signal(page, "signed-in");
  await expect(page.getByText("BBBBBB", { exact: true })).toBeVisible();
  await expect(page.getByText("AAAAAA", { exact: true })).toHaveCount(0);
  expect(harness.sockets[0]?.closed).toBe(true);
  await expect(page.getByText("user-b (You)", { exact: true })).toBeVisible();
});

test("replacing a signed-in identity removes the previous match from URL and Play", async ({ page }) => {
  const harness = await fixture(page);
  await page.goto(`${WEB}/play/?match=old-match`);
  await expect.poll(() => harness.matchReads()).toBeGreaterThan(0);
  harness.setIdentity("user-b");
  await signal(page, "signed-in");
  await expect(page.getByText("BBBBBB", { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("match")).toBe(false);
  await expect(page.getByRole("button", { name: "Start round" })).toHaveCount(0);
});

test("same-user token renewal keeps Lobby room state and explicitly rejoins its fresh socket", async ({ page }) => {
  const harness = await fixture(page);
  await page.goto(`${WEB}/play/`);
  await expect(page.getByText("AAAAAA", { exact: true })).toBeVisible();
  await expect.poll(() => harness.sockets.at(-1)?.rooms).toContain("room-user-a");
  const socketsBefore = harness.sockets.length;
  const previous = harness.sockets.at(-1)!;
  const reads = harness.reads();
  harness.rotate();
  await signal(page, "token-renewed");
  await expect.poll(() => harness.sockets.length).toBe(socketsBefore + 1);
  await expect.poll(() => harness.sockets.at(-1)?.rooms).toContain("room-user-a");
  expect(previous.closed).toBe(true);
  expect(harness.reads()).toBeGreaterThan(reads);
  await expect(page.getByText("AAAAAA", { exact: true })).toBeVisible();
});

test("a temporary Auth outage is shown as unavailable and retry recovers", async ({ page }) => {
  let unavailable = true;
  await page.route("**/auth/refresh", (route) => route.fulfill(unavailable ? { status: 503, json: { error: "temporarily unavailable" } } : { status: 401, json: { error: "anonymous" } }));
  await page.goto(`${WEB}/play/`);
  await expect(page.getByRole("alert")).toContainText("Session unavailable");
  await expect(page.getByText("Sign in to play.")).toHaveCount(0);
  unavailable = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Sign in to play.")).toBeVisible();
});

for (const entry of ["/play/?user=forged-user", "/?live=1&user=forged-user&match=old-match"]) {
  test(`production entry ignores development identity: ${entry}`, async ({ page }) => {
    test.skip(process.env.TASK2_PRODUCTION !== "1", "Requires the production build fixture");
    const requests: string[] = [];
    await page.route("**/auth/refresh", (route) => route.fulfill({ status: 401, json: { error: "anonymous" } }));
    page.on("request", (request) => { if (request.url().includes("/lobby/") || request.url().includes("/matches/")) requests.push(request.url()); });
    await page.goto(`${WEB}${entry}`);
    await expect(page.getByText("Sign in to play.")).toBeVisible();
    expect(requests).toEqual([]);
    await expect(page.getByRole("group", { name: "Mode (mock)" })).toHaveCount(0);
  });
}


test("an authenticated renewal outage preserves Lobby identity and room state", async ({ page }) => {
  const harness = await fixture(page, "user-a", true);
  await page.goto(`${WEB}/play/`);
  await expect(page.getByText("AAAAAA", { exact: true })).toBeVisible();
  await expect.poll(() => harness.sockets.at(-1)?.rooms).toContain("room-user-a");
  const count = harness.sockets.length;
  await page.route("**/auth/refresh", (route) => route.fulfill({ status: 503, json: { message: "Auth temporarily unavailable" } }));
  await page.getByRole("button", { name: "Ready Up" }).click();
  await expect(page.getByRole("alert")).toContainText("Auth temporarily unavailable");
  await expect(page.getByText("AAAAAA", { exact: true })).toBeVisible();
  await expect(page.getByText("Sign in to play.")).toHaveCount(0);
  expect(harness.sockets.length).toBe(count);
});

test("remote sign-out closes the Lobby and returns to sign-in", async ({ page }) => {
  const harness = await fixture(page);
  await page.goto(`${WEB}/play/`);
  await expect(page.getByText("AAAAAA", { exact: true })).toBeVisible();
  await expect.poll(() => harness.sockets.at(-1)?.rooms).toContain("room-user-a");
  const previous = harness.sockets.at(-1)!;
  await signal(page, "signed-out");
  await expect(page.getByText("Sign in to play.")).toBeVisible();
  await expect(page.getByText("AAAAAA", { exact: true })).toHaveCount(0);
  expect(previous.closed).toBe(true);
});
