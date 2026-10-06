import test from "node:test";
import assert from "node:assert/strict";
import { seedUsers, stats, validateProfile, protectLastAdmin } from "./mockService.js";

test("registration counters use rolling windows and exclude future accounts", () => {
    const asOf = new Date("2026-10-05T12:00:00Z");
    const users = [
        { role: "USER", createdAt: "2026-10-05T11:00:00Z" },
        { role: "SUPERADMIN", createdAt: "2026-09-28T12:00:00Z" },
        { role: "USER", createdAt: "2026-09-10T12:00:00Z" },
        { role: "USER", createdAt: "2026-10-06T12:00:00Z" }
    ];
    assert.deepEqual(stats(users, asOf), {
        totalUsers: 4,
        regularUsers: 3,
        superadmins: 1,
        newUsersLast7Days: 2,
        newUsersLast30Days: 3,
        asOf: asOf.toISOString()
    });
});
test("protects the final superadmin while allowing ordinary user removal", () => {
    const users = [{ role: "SUPERADMIN" }, { role: "USER" }];
    assert.throws(() => protectLastAdmin(users, users[0]), /last superadmin/);
    assert.doesNotThrow(() => protectLastAdmin(users, users[1]));
    assert.doesNotThrow(() => protectLastAdmin([...users, { role: "SUPERADMIN" }], users[0]));
});
test("rejects duplicate identities but permits editing the same account", () => {
    const user = { id: "one", username: "alex", email: "alex@example.com" };
    assert.throws(
        () => validateProfile({ ...user, email: "ALEX@example.com" }, [user], "two", false),
        /already in use/
    );
    assert.doesNotThrow(() => validateProfile(user, [user], "one", false));
});
test("validates multibyte password byte limits without saving passwords", () => {
    const values = { username: "new_user", email: "new@example.com", password: "😀".repeat(19) };
    assert.throws(() => validateProfile(values, [], null, true), /Password/);
    assert.doesNotThrow(() =>
        validateProfile({ ...values, password: "a-valid-password" }, [], null, true)
    );
    assert.ok(seedUsers().every(user => !("password" in user)));
});
