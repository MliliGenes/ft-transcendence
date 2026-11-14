import assert from "node:assert/strict";
import test from "node:test";
import { mountAuthProvider } from "./helpers/auth-provider-harness.mjs";

async function initialRestore(pathname) {
  const provider = await mountAuthProvider(pathname);
  return provider.calls();
}

for (const pathname of ["/privacy", "/terms", "/feed"]) {
  test(`returning users restore their cookie session when first opening ${pathname}`, async () => {
    assert.equal(await initialRestore(pathname), 1);
  });
}
test("login leaves session restoration to the explicit sign-in flow", async () => {
  assert.equal(await initialRestore("/login"), 0);
});

test("a near-expiry session refreshes before an Arena snapshot request", async () => {
  const sessions = [
    { user: { id: "viewer" }, accessToken: "fresh-token", tokenType: "Bearer", expiresIn: 900 },
  ];
  const provider = await mountAuthProvider("/login", {
    onRefresh: async () => ({ status: 200, body: sessions.shift() }),
  });
  provider.value.setSession({ user: { id: "viewer" }, accessToken: "near-expiry", tokenType: "Bearer", expiresIn: 10 });
  const sentTokens = [];

  await provider.value.requestWithSession(async (token) => {
    sentTokens.push(token);
    if (token === "near-expiry") {
      const error = new Error("expired access token");
      error.status = 401;
      throw error;
    }
    return { revision: 1 };
  });

  assert.deepEqual(sentTokens, ["fresh-token"], "Arena must not send a snapshot request with a near-expiry token");
  assert.equal(provider.calls(), 1, "the provider refreshes once before sending the request");
});

test("requestWithSession rejects with UnauthenticatedSessionError and generic sign-in message when session is absent", async () => {
  const provider = await mountAuthProvider("/login", async () => undefined);
  await assert.rejects(
    () => provider.value.requestWithSession(async () => {}),
    (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.name, "UnauthenticatedSessionError");
      assert.equal(error.message, "Please sign in to continue.");
      return true;
    },
  );
});

// --- Transient refresh failures must not end a still-usable session ---------

async function assertTransientRefreshKeepsSession(descriptor) {
  let failing = true;
  const provider = await mountAuthProvider("/login", {
    onRefresh: async () => (failing
      ? descriptor
      : { status: 200, body: { user: { id: "viewer" }, accessToken: "recovered-token", tokenType: "Bearer", expiresIn: 900 } }),
  });
  provider.value.setSession({ user: { id: "viewer" }, accessToken: "near-expiry", tokenType: "Bearer", expiresIn: 10 });

  await assert.rejects(
    () => provider.value.requestWithSession(async () => ({ ok: true })),
    (error) => {
      assert.equal(error.status, descriptor.status);
      return true;
    },
    "the transient failure is reported to the caller instead of being hidden",
  );
  assert.notEqual(provider.session, null, "a transient refresh failure must not end the session");
  assert.equal(provider.calls(), 1, "the failed refresh is attempted exactly once");

  failing = false;
  const token = await provider.value.requestWithSession(async (accessToken) => accessToken);
  assert.equal(token, "recovered-token", "the next request refreshes and succeeds");
  assert.equal(provider.calls(), 2, "recovery costs exactly one further refresh");
  assert.notEqual(provider.session, null, "the session survives the recovery");
}

test("an unreachable auth service keeps the session and the next request recovers", async () => {
  await assertTransientRefreshKeepsSession({ networkError: true, status: 0 });
});

test("a failing auth service (500) keeps the session and the next request recovers", async () => {
  await assertTransientRefreshKeepsSession({ status: 500 });
});

// --- A genuine authentication rejection still ends the session --------------

test("a rejected refresh (401) ends the session and stops further refresh attempts", async () => {
  const provider = await mountAuthProvider("/login", { onRefresh: async () => ({ status: 401 }) });
  provider.value.setSession({ user: { id: "viewer" }, accessToken: "stale-token", tokenType: "Bearer", expiresIn: 10 });

  await assert.rejects(
    () => provider.value.requestWithSession(async () => ({ ok: true })),
    (error) => {
      assert.equal(error.status, 401);
      return true;
    },
  );
  assert.equal(provider.session, null, "an authentication rejection must end the session");

  await assert.rejects(
    () => provider.value.requestWithSession(async () => ({ ok: true })),
    (error) => {
      assert.equal(error.name, "UnauthenticatedSessionError");
      assert.equal(error.status, 401);
      return true;
    },
    "a cleared session reports the signed-out error instead of refreshing again",
  );
  assert.equal(provider.calls(), 1, "a cleared session never refreshes again");
});

test("initial session restoration finishes even when the auth service rejects the refresh", async () => {
  const provider = await mountAuthProvider("/feed", { onRefresh: async () => ({ status: 401 }) });
  assert.equal(provider.calls(), 1);
  assert.equal(provider.isRestoring, false, "restoration always settles");
  assert.equal(provider.session, null);
});

// --- Refresh shape guarantees ------------------------------------------------

test("concurrent authenticated requests share a single refresh", async () => {
  const provider = await mountAuthProvider("/login", {
    onRefresh: async () => ({
      status: 200,
      body: { user: { id: "viewer" }, accessToken: "shared-token", tokenType: "Bearer", expiresIn: 900 },
    }),
  });
  provider.value.setSession({ user: { id: "viewer" }, accessToken: "near-expiry", tokenType: "Bearer", expiresIn: 10 });
  const sent = [];
  const send = async (token) => { sent.push(token); return token; };

  const results = await Promise.all([
    provider.value.requestWithSession(send),
    provider.value.requestWithSession(send),
  ]);

  assert.deepEqual(results, ["shared-token", "shared-token"]);
  assert.equal(provider.calls(), 1, "concurrent requests must share one refresh");
  assert.deepEqual(sent, ["shared-token", "shared-token"]);
});

test("a rejected request is retried exactly once with a refreshed token", async () => {
  const provider = await mountAuthProvider("/login", {
    onRefresh: async () => ({
      status: 200,
      body: { user: { id: "viewer" }, accessToken: "fresh-token", tokenType: "Bearer", expiresIn: 900 },
    }),
  });
  provider.value.setSession({ user: { id: "viewer" }, accessToken: "long-lived", tokenType: "Bearer", expiresIn: 3600 });
  const sent = [];
  const send = async (token) => {
    sent.push(token);
    if (sent.length === 1) {
      const error = new Error("expired access token");
      error.status = 401;
      throw error;
    }
    return "ok";
  };

  const result = await provider.value.requestWithSession(send);

  assert.equal(result, "ok");
  assert.deepEqual(sent, ["long-lived", "fresh-token"], "one retry with the refreshed token, never more");
  assert.equal(provider.calls(), 1, "exactly one refresh for the retry");
});
