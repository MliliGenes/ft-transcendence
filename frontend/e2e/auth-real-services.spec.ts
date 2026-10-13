import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { io } from "socket.io-client";

test.describe.configure({ mode: "serial" });
const fixturePath = process.env.E2E_REAL_AUTH_FIXTURE;
test.skip(
  !fixturePath,
  "Requires the separate owned real-service auth proof fixture",
);
const fixture = fixturePath
  ? (JSON.parse(readFileSync(fixturePath, "utf8")) as {
      origin: string;
      password: string;
      users: Array<{ username: string; email: string }>;
    })
  : null;
if (fixture && fixture.origin !== "https://localhost:18443")
  throw new Error("Use the owned auth proof HTTPS origin only");
const handshakes: Array<Record<string, number>> = [];
const baselines: Array<Record<string, number>> = [];
const contexts: BrowserContext[] = [];
const pages: Page[] = [];
const tokens: string[] = [];
const errors: string[] = [];
let teamMatch = "";

async function login(page: Page, index: number) {
  await page.goto(`${fixture!.origin}/login`);
  await page
    .getByLabel("Email address", { exact: true })
    .fill(fixture!.users[index]!.email);
  await page.getByLabel(/^Password/).fill(fixture!.password);
  const response = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/auth/login" &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: /^Log in/ })
    .last()
    .click();
  expect((await response).status()).toBe(200);
  await expect(page.locator(".signed-in-as")).toHaveText(
    `@${fixture!.users[index]!.username}`,
  );
}
async function play(page: Page) {
  await page.getByRole("link", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /^Code Arena(?: Lobby)?$/ }),
  ).toBeVisible();
  if (new URL(page.url()).searchParams.has("match")) {
    const leaveButton = page.getByRole("button", {
      name: "Leave match",
      exact: true,
    });
    if (await leaveButton.isVisible()) {
      page.once("dialog", (dialog) => dialog.accept());
      await leaveButton.click();
      await expect(
        page.getByText("Match complete.", { exact: true }),
      ).toBeVisible();
    }
    await page.goto(`${fixture!.origin}/play/`);
  }
  await expect(
    page.getByRole("heading", { name: "Code Arena Lobby", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.has("user")).toBe(false);
  await expect(page.getByLabel("Mock controls")).toHaveCount(0);
}
async function api(
  index: number,
  method: string,
  path: string,
  data?: unknown,
) {
  return pages[index]!.request.fetch(`${fixture!.origin}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${tokens[index]}` },
    data,
  });
}
async function createRoom(mode: "1v1" | "2v2", indices: number[]) {
  const host = pages[indices[0]!]!;
  await host.getByRole("button", { name: mode, exact: true }).click();
  await host
    .getByRole("button", { name: `Create ${mode} Room`, exact: true })
    .click();
  const code = host.locator("span.font-mono.text-base.font-bold");
  await expect(code).toBeVisible();
  const value = (await code.textContent())!.trim();
  expect(value).toHaveLength(6);
  for (const index of indices.slice(1)) {
    const page = pages[index]!;
    await page.getByPlaceholder("INVITE CODE").fill(value);
    await page.getByRole("button", { name: "Join", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Ready Up", exact: true }),
    ).toBeVisible();
  }
  for (const index of indices) {
    if (index === 0 && mode === "2v2") {
      const oldCount = handshakes[0]!["/lobby"] ?? 0;
      const claims = JSON.parse(
        Buffer.from(tokens[0]!.split(".")[1]!, "base64url").toString(),
      );
      await host.clock.setFixedTime(new Date(claims.exp * 1000 - 5000));
      try {
        const renewed = host.waitForResponse(
          (r) => new URL(r.url()).pathname === "/api/auth/refresh" && r.ok(),
        );
        await host
          .getByRole("button", { name: "Ready Up", exact: true })
          .click();
        await renewed;
      } finally {
        await host.clock.setFixedTime(new Date());
      }
      await expect
        .poll(() => handshakes[0]!["/lobby"] ?? 0)
        .toBeGreaterThan(oldCount);
      await expect(code).toHaveText(value);
    } else
      await pages[index]!.getByRole("button", {
        name: "Ready Up",
        exact: true,
      }).click();
    await expect(
      pages[index]!.getByRole("button", { name: "Cancel Ready", exact: true }),
    ).toBeVisible();
  }
  await expect(
    host.getByRole("button", { name: "Start Match", exact: true }),
  ).toBeEnabled();
  await host.getByRole("button", { name: "Start Match", exact: true }).click();
  for (const index of indices)
    await expect(
      pages[index]!.getByRole("heading", { name: "Code Arena", exact: true }),
    ).toBeVisible();
  const match = new URL(host.url()).searchParams.get("match")!;
  for (const index of indices)
    expect(new URL(pages[index]!.url()).searchParams.get("match")).toBe(match);
  await host.getByRole("button", { name: "Start round", exact: true }).click();
  for (const index of indices)
    await expect(pages[index]!.getByLabel(/Solution editor/)).toBeVisible();
  return match;
}
async function solution(index: number, match: string) {
  const response = await api(index, "GET", `/matches/${match}/snapshot`);
  expect(response.status()).toBe(200);
  const snapshot = await response.json();
  return (snapshot.problem.id ?? snapshot.problem.problemVersionId) ===
    "double-it"
    ? "import sys\nprint(int(sys.stdin.read().strip()) * 2)\n"
    : "def ledger_sum(nums):\n    return sum(v if i % 2 == 0 else -v for i, v in enumerate(nums))\n";
}
async function leave(index: number) {
  pages[index]!.once("dialog", (dialog) => dialog.accept());
  await pages[index]!.getByRole("button", {
    name: "Leave match",
    exact: true,
  }).click();
  await expect(
    pages[index]!.getByText("Match complete.", { exact: true }),
  ).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  const anonymous = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const entry = await anonymous.newPage();
    await entry.goto(
      `${fixture!.origin}/play/?user=untrusted-development-identity`,
    );
    await expect(entry.getByText(/sign in to play/i)).toBeVisible();
    await expect(entry.getByLabel("Mock controls")).toHaveCount(0);
    const devRequest = await entry.request.get(
      `${fixture!.origin}/api/lobby/active`,
      { headers: { "x-dev-user-id": "untrusted-development-identity" } },
    );
    expect(devRequest.status()).toBe(401);
  } finally {
    await anonymous.close();
  }
  for (let i = 0; i < 4; i++) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1000 },
    });
    contexts.push(context);
    const page = await context.newPage();
    pages.push(page);
    page.setDefaultTimeout(15000);
    handshakes[i] = {};
    baselines[i] = {};
    const sentPacket = (payload: string) => {
      for (const packet of payload.split("\x1e")) {
        const match = /^40(\/[^,]+)?(?:,|\{)/.exec(packet);
        if (match) {
          const namespace = match[1] ?? "/";
          handshakes[i]![namespace] = (handshakes[i]![namespace] ?? 0) + 1;
        }
      }
    };
    const receivedPacket = (payload: string) => {
      for (const packet of payload.split("\x1e")) {
        const match = /^42(?:\/[^,]+,)?\["(snapshot|sync|authorized)"/.exec(
          packet,
        );
        if (match)
          baselines[i]![match[1]!] = (baselines[i]![match[1]!] ?? 0) + 1;
      }
    };
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.pathname === "/socket.io/" &&
        url.searchParams.get("transport") === "polling" &&
        request.method() === "POST"
      )
        sentPacket(request.postData() ?? "");
    });
    page.on("websocket", (socket) => {
      socket.on("framesent", ({ payload }) => {
        if (typeof payload !== "string") return;
        sentPacket(payload);
      });
      socket.on("framereceived", ({ payload }) => {
        if (typeof payload !== "string") return;
        receivedPacket(payload);
      });
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", async (response) => {
      const url = new URL(response.url());
      if (
        url.pathname === "/socket.io/" &&
        url.searchParams.get("transport") === "polling" &&
        response.ok()
      )
        receivedPacket(await response.text().catch(() => ""));
      if (
        ["/api/auth/login", "/api/auth/refresh"].includes(
          new URL(response.url()).pathname,
        ) &&
        response.ok()
      ) {
        const body = await response.json().catch(() => null);
        if (body?.accessToken) tokens[i] = body.accessToken;
      }
    });
    await login(page, i);
    await play(page);
  }
});
test.afterAll(async () => {
  await Promise.all(contexts.map((context) => context.close()));
});

test("real HTTPS password login through Account Play and Lobby produces a playable 1v1", async () => {
  const match = await createRoom("1v1", [0, 1]);
  const code = await solution(0, match);
  for (const page of pages.slice(0, 2))
    await page.getByLabel(/Solution editor/).fill(code);
  await pages[0]!.getByRole("button", { name: "Run", exact: true }).click();
  await expect(
    pages[0]!
      .getByLabel("Visible tests")
      .getByText("Passed", { exact: true })
      .first(),
  ).toBeVisible({ timeout: 60000 });
  for (const page of pages.slice(0, 2))
    await page.getByRole("button", { name: "Submit", exact: true }).click();
  for (const page of pages.slice(0, 2))
    await expect(
      page.getByRole("heading", { name: "Round 1: 100 / 100", exact: true }),
    ).toBeVisible({ timeout: 60000 });
  await leave(0);
  for (const page of pages.slice(0, 2)) {
    await page.goto(`${fixture!.origin}/play/`);
    await expect(
      page.getByRole("heading", { name: "Code Arena Lobby", exact: true }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("real HTTPS four-player 2v2 shares code and team chat and produces team scores", async () => {
  teamMatch = await createRoom("2v2", [0, 1, 2, 3]);
  const code = await solution(0, teamMatch);
  for (const [author, teammate, opponent, marker] of [
    [0, 1, 2, "alpha-real-proof"],
    [2, 3, 0, "beta-real-proof"],
  ] as const) {
    await expect(
      pages[author]!.getByText(/Shared doc r1 · live/),
    ).toBeVisible();
    await pages[author]!.getByLabel(/Solution editor/).fill(
      code + `# ${marker}\n`,
    );
    await expect(pages[teammate]!.getByLabel(/Solution editor/)).toContainText(
      marker,
    );
    await expect(
      pages[opponent]!.getByLabel(/Solution editor/),
    ).not.toContainText(marker);
    await pages[author]!.getByRole("textbox", { name: "Team message" }).fill(
      marker,
    );
    await pages[author]!.getByRole("button", {
      name: "Send team message",
    }).click();
    await expect(
      pages[teammate]!.getByLabel("Team chat")
        .getByRole("listitem")
        .filter({ hasText: marker }),
    ).toBeVisible();
    await expect(
      pages[opponent]!.getByLabel("Team chat")
        .getByRole("listitem")
        .filter({ hasText: marker }),
    ).toHaveCount(0);
  }
  for (const page of pages) {
    await page.getByLabel("You are ready").click();
    await expect(page.getByLabel("You are ready")).toBeChecked();
  }
  for (const index of [0, 2]) {
    const button = pages[index]!.getByRole("button", {
      name: "Submit Team Solution",
      exact: true,
    });
    await expect(button).toBeEnabled();
    await button.click();
  }
  for (const page of pages)
    await expect(
      page.getByRole("heading", { name: "Round 1: 100 / 100", exact: true }),
    ).toBeVisible({ timeout: 60000 });
  expect(errors).toEqual([]);
});

test("same-user renewal keeps the 2v2 document and chat; all four namespaces disconnect at idle expiry", async () => {
  const page = pages[0]!;
  await page.getByRole("button", { name: "Next round", exact: true }).click();
  await page.getByRole("button", { name: "Start round", exact: true }).click();
  for (const member of pages)
    await expect(member.getByLabel(/Solution editor/)).toBeVisible();
  await page
    .getByLabel(/Solution editor/)
    .fill("# retained through real renewal\n");
  await expect(pages[1]!.getByLabel(/Solution editor/)).toContainText(
    "retained through real renewal",
  );
  await page.evaluate(() => {
    const globals = window as unknown as {
      __arenaCollab: object;
      __arenaChat: object;
      __proofClients: object[];
    };
    globals.__proofClients = [globals.__arenaCollab, globals.__arenaChat];
  });
  const previousHandshakes = { ...handshakes[0] };
  const previousBaselines = { ...baselines[0] };
  const oldClaims = JSON.parse(
    Buffer.from(tokens[0]!.split(".")[1]!, "base64url").toString(),
  );
  await page.clock.setFixedTime(new Date(oldClaims.exp * 1000 - 5000));
  try {
    const refreshed = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/auth/refresh" && r.ok(),
    );
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await refreshed;
  } finally {
    await page.clock.setFixedTime(new Date());
  }
  await expect(
    page.getByRole("button", { name: "Run", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("textbox", { name: "Team message" })
    .fill("after-real-renewal");
  await page.getByRole("button", { name: "Send team message" }).click();
  await expect(
    pages[1]!
      .getByLabel("Team chat")
      .getByRole("listitem")
      .filter({ hasText: "after-real-renewal" }),
  ).toBeVisible();
  await expect(page.getByLabel(/Solution editor/)).toContainText(
    "retained through real renewal",
  );
  expect(
    await page.evaluate(() => {
      const g = window as unknown as {
        __arenaCollab: object;
        __arenaChat: object;
        __proofClients: object[];
      };
      return (
        g.__proofClients[0] === g.__arenaCollab &&
        g.__proofClients[1] === g.__arenaChat
      );
    }),
  ).toBe(true);
  expect(new URL(page.url()).searchParams.get("match")).toBe(teamMatch);
  for (const namespace of ["/", "/collab", "/chat"]) {
    await expect
      .poll(() => handshakes[0]![namespace] ?? 0)
      .toBeGreaterThan(previousHandshakes[namespace] ?? 0);
  }
  for (const event of ["snapshot", "sync", "authorized"]) {
    await expect
      .poll(() => baselines[0]![event] ?? 0)
      .toBeGreaterThan(previousBaselines[event] ?? 0);
  }

  const key = readFileSync(process.env.E2E_REAL_AUTH_KEY!, "utf8");
  const claims = JSON.parse(
    Buffer.from(tokens[0]!.split(".")[1]!, "base64url").toString(),
  );
  const expiry = Math.floor(Date.now() / 1000) + 5;
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: claims.sub,
      iss: "user-service",
      aud: "ft-transcendence-api",
      iat: Math.floor(Date.now() / 1000),
      exp: expiry,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const token = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), key).toString("base64url")}`;
  const principal = await page.request.get(
    `${fixture!.origin}/api/auth/principal`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(principal.status()).toBe(200);
  const sockets = ["/", "/lobby", "/collab", "/chat"].map((namespace) =>
    io(fixture!.origin + (namespace === "/" ? "" : namespace), {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      rejectUnauthorized: false,
      autoConnect: false,
      auth: { accessToken: token, matchId: teamMatch },
    }),
  );
  try {
    const disconnected = sockets.map(
      (socket) =>
        new Promise<string>((resolve) => socket.once("disconnect", resolve)),
    );
    const admission = sockets.map(
      (socket, index) =>
        new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error(`namespace ${index} admission timed out`)),
            4000,
          );
          const admitted = () => {
            clearTimeout(timeout);
            resolve();
          };
          socket.once("connect_error", () => {
            clearTimeout(timeout);
            reject(new Error(`namespace ${index} rejected`));
          });
          socket.once(
            index === 0
              ? "snapshot"
              : index === 2
                ? "sync"
                : index === 3
                  ? "authorized"
                  : "connect",
            admitted,
          );
          socket.connect();
        }),
    );
    await Promise.all(admission);
    const lobbyAck = await sockets[1]!
      .timeout(1500)
      .emitWithAck("lobby:leave_room", {});
    expect(lobbyAck.ok).toBe(true);
    // No application event follows admission: the server must close each idle socket.
    const reasons = await Promise.race([
      Promise.all(disconnected),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("idle expiry did not close all namespaces")),
          7000,
        ),
      ),
    ]);
    expect(reasons).toEqual([
      "io server disconnect",
      "io server disconnect",
      "io server disconnect",
      "io server disconnect",
    ]);
    expect(Date.now()).toBeGreaterThanOrEqual(expiry * 1000);
    expect(Date.now()).toBeLessThan(expiry * 1000 + 2000);
  } finally {
    sockets.forEach((socket) => socket.close());
  }
  expect(errors).toEqual([]);
});

function ownedAuthService(action: "stop" | "start") {
  const container = "auth-repair-proof-20261013-user-service-1";
  const project = execFileSync(
    "docker",
    [
      "inspect",
      "--format",
      '{{index .Config.Labels "com.docker.compose.project"}}',
      container,
    ],
    { encoding: "utf8" },
  ).trim();
  if (project !== "auth-repair-proof-20261013")
    throw new Error("Proof service ownership mismatch");
  execFileSync("docker", [action, container], { stdio: "ignore" });
}

test("real Auth outage is 503, root HttpOnly cookie migrates, and logout blocks reload across both SPAs", async () => {
  const page = pages[0]!;
  const outageAccount = await contexts[0]!.newPage();
  outageAccount.setDefaultTimeout(15000);
  ownedAuthService("stop");
  try {
    const response = await api(0, "GET", `/matches/${teamMatch}/snapshot`);
    expect(response.status()).toBe(503);
    const rejected = page.waitForResponse((r) =>
      new URL(r.url()).pathname.endsWith(`/matches/${teamMatch}/run`),
    );
    await page.getByRole("button", { name: "Run", exact: true }).click();
    expect((await rejected).status()).toBe(503);
    await expect(page.getByRole("alert")).toContainText("unavailable");
    await outageAccount.goto(`${fixture!.origin}/account`);
    await expect(
      outageAccount.getByRole("heading", {
        name: "We couldn’t load your account.",
        exact: true,
      }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      outageAccount.getByLabel("Email address", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel(/Solution editor/)).toContainText(
      "retained through real renewal",
    );
    await expect(page.getByText(/sign in to play/i)).toHaveCount(0);
  } finally {
    ownedAuthService("start");
  }
  await expect
    .poll(
      async () => (await page.request.get(`${fixture!.origin}/api/`)).status(),
      { timeout: 45000 },
    )
    .toBe(200);
  expect((await api(0, "GET", `/matches/${teamMatch}/snapshot`)).status()).toBe(
    200,
  );
  await outageAccount
    .getByRole("heading", { name: "We couldn’t load your account.", exact: true })
    .locator("..")
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expect(outageAccount.locator(".signed-in-as")).toHaveText(
    `@${fixture!.users[0]!.username}`,
  );
  await outageAccount.close();
  await page.goto(`${fixture!.origin}/account`);
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  const canonical = (await contexts[0]!.cookies()).find(
    (cookie) => cookie.name === "auth-refresh",
  )!;
  expect(canonical.httpOnly).toBe(true);
  expect(canonical.path).toBe("/api/auth/");
  await contexts[0]!.addCookies([{ ...canonical, path: "/" }]);
  expect(
    (await contexts[0]!.cookies()).filter(
      (cookie) => cookie.name === "auth-refresh",
    ).length,
  ).toBe(2);
  // A deliberate normal password login must delete the old HttpOnly root cookie.
  const migration = await page.request.post(
    `${fixture!.origin}/api/auth/login`,
    {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Origin: fixture!.origin,
        Referer: `${fixture!.origin}/login`,
      },
      data: { email: fixture!.users[0]!.email, password: fixture!.password },
    },
  );
  expect(migration.status()).toBe(200);
  const migrated = (await contexts[0]!.cookies()).filter(
    (cookie) => cookie.name === "auth-refresh",
  );
  expect(
    migrated.map((cookie) => [cookie.path, cookie.httpOnly, cookie.secure]),
  ).toEqual([["/api/auth/", true, true]]);

  const oldPlay = await contexts[0]!.newPage();
  await oldPlay.goto(`${fixture!.origin}/play/?match=${teamMatch}`);
  await expect(oldPlay.getByLabel(/Solution editor/)).toBeVisible();
  // Cookie loss permits a second tab to use the normal login UI. Its real SDK
  // sign-in broadcast must replace the still-authenticated old Game scope.
  await contexts[0]!.clearCookies({ name: "auth-refresh" });
  const replacement = await contexts[0]!.newPage();
  await login(replacement, 4);
  await expect(page.locator(".signed-in-as")).toHaveText(
    `@${fixture!.users[4]!.username}`,
  );
  await expect(
    oldPlay.getByRole("heading", { name: "Code Arena Lobby", exact: true }),
  ).toBeVisible();
  expect(new URL(oldPlay.url()).searchParams.has("match")).toBe(false);
  await expect(oldPlay.getByLabel(/Solution editor/)).toHaveCount(0);
  await replacement.close();
  await oldPlay.close();

  // This is a network failure, not an auth/profile/match response mock.
  await page.route("**/api/auth/logout", (route) =>
    route.abort("connectionfailed"),
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByText(/service could not confirm/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  await page.goto(`${fixture!.origin}/play/`);
  await expect(page.getByText(/sign in to play/i)).toBeVisible();
  await page.unroute("**/api/auth/logout");
  await login(page, 4);
  await expect(page.locator(".signed-in-as")).toHaveText(
    `@${fixture!.users[4]!.username}`,
  );
  const otherTab = await contexts[0]!.newPage();
  await otherTab.goto(`${fixture!.origin}/play/`);
  await expect(
    otherTab.getByRole("heading", { name: "Code Arena Lobby", exact: true }),
  ).toBeVisible();
  const signedOut = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/auth/logout",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  expect((await signedOut).status()).toBe(204);
  await expect(otherTab.getByText(/sign in to play/i)).toBeVisible();
  expect(
    (await contexts[0]!.cookies()).filter(
      (cookie) => cookie.name === "auth-refresh",
    ).length,
  ).toBe(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  await otherTab.close();
  expect(errors).toEqual([]);
});
