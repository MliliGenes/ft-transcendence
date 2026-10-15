import assert from "node:assert/strict";
import { test } from "node:test";
import { createAdminApi, userQuery } from "../src/admin/adminApi.js";

test("admin query forwards filters, literal search, pagination, and full inclusive UTC dates", () => {
    const query = new URLSearchParams(userQuery({ search: " a%_\\b ", role: "USER", from: "2026-10-01", to: "2026-10-15", sort: "username", order: "asc", page: 2, limit: 20 }));
    assert.equal(query.get("search"), "a%_\\b");
    assert.equal(query.get("createdTo"), "2026-10-15T23:59:59.999Z");
    assert.equal(query.get("createdFrom"), "2026-10-01T00:00:00.000Z");
    assert.equal(query.get("page"), "2"); assert.equal(query.get("limit"), "20");
});

test("create sends only the supported body fields", async () => {
    let request;
    const api = createAdminApi({ request: async (...args) => { request = args; return {}; } });
    await api.create({ username: " eva ", email: " eva@example.com ", password: "keep spaces ", role: "USER", id: "ignored", firstName: "ignored" });
    assert.equal(request[0], "/superadmin/users");
    assert.deepEqual(request[1].json, { username: "eva", email: "eva@example.com", password: "keep spaces ", role: "USER" });
});

test("profile edits omit role and password and skip unchanged edits", async () => {
    const calls = [];
    const api = createAdminApi({ request: async (...args) => { calls.push(args); return {}; } });
    const user = { id: "one", username: "eva", email: "eva@example.com", lastName: "Smith" };
    const values = { username: "eva", email: "eva@example.com", firstName: "", displayName: "", lastName: "Smith", password: "ignored", role: "SUPERADMIN" };
    assert.deepEqual(await api.update(user, values), user); assert.equal(calls.length, 0);
    await api.update(user, { ...values, lastName: "" });
    assert.deepEqual(calls[0][1].json, { lastName: null });
});

test("role edits and deletion use distinct endpoint contracts", async () => {
    const calls = [];
    const api = createAdminApi({ request: async (...args) => { calls.push(args); return null; } });
    await api.role("one", "USER"); await api.remove("one");
    assert.equal(calls[0][0], "/superadmin/users/one/role");
    assert.deepEqual(calls[0][1], { method: "PATCH", json: { role: "USER" } });
    assert.deepEqual(calls[1], ["/superadmin/users/one", { method: "DELETE" }]);
});

test("admin errors propagate for inline form handling", async () => {
    const conflict = Object.assign(new Error("Last superadmin"), { status: 409 });
    const api = createAdminApi({ request: async () => { throw conflict; } });
    await assert.rejects(api.remove("one"), error => error === conflict);
});
