import assert from "node:assert/strict";
import { test } from "node:test";
import { createSessionStore, consumeOAuthReturn, clearLegacySession, LEGACY_TOKEN_KEY } from "../src/lib/session.js";
import { createApiClient } from "../src/lib/api-client.js";
import { profilePatch, toProfileForm, passwordError, imageError, mediaUrl } from "../src/lib/account.js";

const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
const tokens = n => ({ accessToken: `access-${n}` });
const unauthorized = () => json({ message: "Expired" }, 401);

// Updated from the ZIP's obsolete local-storage token tests to its HttpOnly-cookie contract.
test("sessions keep only an access token in memory and reject incomplete responses", () => {
    const store = createSessionStore();
    assert.equal(store.read(), null);
    assert.throws(() => store.replace({}), /incomplete/);
    const session = store.replace({ ...tokens(1), refreshToken: "never-store-this" });
    assert.equal(session.accessToken, "access-1");
    assert.equal("refreshToken" in session, false);
});

test("rotation requires the expected session and stale clears preserve a newer login", () => {
    const store = createSessionStore();
    const original = store.replace(tokens(1));
    const rotated = store.rotate(tokens(2), original);
    assert.equal(rotated.sessionKey, original.sessionKey);
    assert.equal(store.rotate(tokens(3), original), null);
    const newer = store.replace(tokens(4));
    store.clear(original.sessionKey);
    assert.deepEqual(store.read(), newer);
});

test("session subscriptions can be removed", () => {
    const store = createSessionStore(); let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    store.replace(tokens(1)); unsubscribe(); store.clear();
    assert.equal(calls, 1);
});

test("legacy credentials are removed without depending on browser storage", () => {
    const removed = [];
    globalThis.window = { localStorage: { removeItem: key => removed.push(key) } };
    clearLegacySession();
    assert.deepEqual(removed, [LEGACY_TOKEN_KEY]);
    window.localStorage.removeItem = () => { throw new Error("disabled"); };
    assert.doesNotThrow(clearLegacySession);
    delete globalThis.window;
});

test("OAuth token fragments are scrubbed instead of being stored", () => {
    let replaced;
    const notice = consumeOAuthReturn({ hash: "#accessToken=old&refreshToken=old", pathname: "/account", search: "" }, { replaceState: (...args) => { replaced = args; } });
    assert.equal(replaced[2], "/account");
    assert.equal(notice.type, "error");
});

test("OAuth linking status is preserved without leaking provider errors", () => {
    const history = { replaceState() {} };
    assert.equal(consumeOAuthReturn({ hash: "#providerLinked=github", pathname: "/account", search: "" }, history).type, "success");
    assert.equal(consumeOAuthReturn({ hash: "", pathname: "/account", search: "" }, history), null);
});

test("simultaneous protected 401s share one cookie refresh", async () => {
    const store = createSessionStore(); store.replace(tokens(1));
    let refreshes = 0;
    const api = createApiClient({ baseUrl: "/api", store, fetchImpl: async (url, options) => {
        assert.equal(options.credentials, "include");
        if (url.endsWith("/auth/refresh")) { refreshes++; assert.equal(options.headers["X-Requested-With"], "XMLHttpRequest"); return json(tokens(2)); }
        return options.headers.Authorization === "Bearer access-2" ? json({ ok: true }) : unauthorized();
    } });
    await Promise.all([api.request("/first"), api.request("/second")]);
    assert.equal(refreshes, 1);
});

test("403, 404 and 500 do not refresh or clear the session", async () => {
    for (const status of [403, 404, 500]) {
        const store = createSessionStore(); const original = store.replace(tokens(1)); let calls = 0;
        const api = createApiClient({ baseUrl: "/api", store, fetchImpl: async () => { calls++; return json({ message: "Rejected" }, status); } });
        await assert.rejects(api.request("/superadmin/users"), error => error.status === status);
        assert.equal(calls, 1); assert.deepEqual(store.read(), original);
    }
});

test("a failed or uncertain refresh clears the local session", async () => {
    const store = createSessionStore(); store.replace(tokens(1));
    const api = createApiClient({ baseUrl: "/api", store, fetchImpl: async url => url.endsWith("/auth/refresh") ? json({ message: "Unavailable" }, 503) : unauthorized() });
    await assert.rejects(api.request("/private"), /renewal could not be confirmed/);
    assert.equal(store.read(), null);
});

test("a request retries only once after renewal", async () => {
    const store = createSessionStore(); store.replace(tokens(1)); let protectedCalls = 0;
    const api = createApiClient({ baseUrl: "/api", store, fetchImpl: async url => {
        if (url.endsWith("/auth/refresh")) return json(tokens(2));
        protectedCalls++; return unauthorized();
    } });
    await assert.rejects(api.request("/private"));
    assert.equal(protectedCalls, 2); assert.equal(store.read(), null);
});

test("a logout during refresh cannot restore the old session", async () => {
    const store = createSessionStore(); store.replace(tokens(1)); let release, started;
    const waiting = new Promise(resolve => { started = resolve; });
    const api = createApiClient({ baseUrl: "/api", store, fetchImpl: async url => {
        if (url.endsWith("/auth/refresh")) { started(); return new Promise(resolve => { release = () => resolve(json(tokens(2))); }); }
        return unauthorized();
    } });
    const request = api.request("/private"); const rejected = assert.rejects(request, /session changed/);
    await waiting; store.clear(); release(); await rejected;
    assert.equal(store.read(), null);
});

test("requests preserve validation messages and accept an empty 204", async () => {
    const store = createSessionStore(); store.replace(tokens(1));
    const api = createApiClient({ baseUrl: "/api", store, fetchImpl: async (_, options) => options.method === "DELETE" ? new Response(null, { status: 204 }) : json({ message: ["First", "Second"] }, 400) });
    await assert.rejects(api.request("/user"), error => error.messages.length === 2);
    assert.equal(await api.request("/user", { method: "DELETE" }), null);
});

test("profile patches contain only changed allowed fields", () => {
    const baseline = toProfileForm({ username: "eva", email: "eva@example.com", lastName: "Smith" });
    const patch = profilePatch({ ...baseline, lastName: "", role: "SUPERADMIN", id: "ignored" }, baseline);
    assert.deepEqual(patch, { lastName: null });
    assert.deepEqual(profilePatch(baseline, baseline), {});
});

test("password byte limits, image bounds and media URL protocols are checked", () => {
    assert.notEqual(passwordError("short", true), "");
    assert.notEqual(passwordError("😀".repeat(20), true), "");
    assert.notEqual(imageError({ type: "image/gif", size: 100 }, "avatar"), "");
    assert.equal(mediaUrl("javascript:alert(1)", "https://localhost/api"), null);
});
