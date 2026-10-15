import { profilePatch, toProfileForm } from "../lib/account.js";

export function userQuery(filters = {}) {
    const query = new URLSearchParams();
    query.set("page", String(filters.page || 1));
    query.set("limit", String(filters.limit || 10));
    query.set("sortBy", filters.sort || "createdAt");
    query.set("sortOrder", filters.order || "desc");
    if (filters.search?.trim()) query.set("search", filters.search.trim());
    if (filters.role) query.set("role", filters.role);
    if (filters.from) query.set("createdFrom", `${filters.from}T00:00:00.000Z`);
    if (filters.to) query.set("createdTo", `${filters.to}T23:59:59.999Z`);
    return query.toString();
}

// Every request uses the account frontend's existing session-aware API client.
export function createAdminApi(client) {
    return {
        stats(options = {}) {
            return client.request("/superadmin/stats", options);
        },
        users(filters, options = {}) {
            return client.request(`/superadmin/users?${userQuery(filters)}`, options);
        },
        user(id, options = {}) {
            return client.request(`/superadmin/users/${encodeURIComponent(id)}`, options);
        },
        create(values) {
            return client.request("/superadmin/users", {
                method: "POST",
                json: {
                    username: values.username.trim(),
                    email: values.email.trim(),
                    password: values.password,
                    role: values.role
                }
            });
        },
        update(user, values) {
            const patch = profilePatch(values, toProfileForm(user));
            if (!Object.keys(patch).length) return Promise.resolve(user);
            return client.request(`/superadmin/users/${encodeURIComponent(user.id)}`, {
                method: "PATCH",
                json: patch
            });
        },
        role(id, role) {
            return client.request(`/superadmin/users/${encodeURIComponent(id)}/role`, {
                method: "PATCH",
                json: { role }
            });
        },
        remove(id) {
            return client.request(`/superadmin/users/${encodeURIComponent(id)}`, {
                method: "DELETE"
            });
        }
    };
}
