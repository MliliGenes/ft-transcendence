import { Search, ArrowUpRight, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { formatDate } from "./adminStyles";
import { buttonStyles, inputStyles, panelStyles } from "./adminStyles";

function UserAvatar({ user }) {
    const name = user.displayName || user.username;
    const initial = name.slice(0, 1).toUpperCase();

    return (
        <span
            className="flex h-10 w-10 shrink-0 items-center justify-center
                       rounded-full border border-cyan-300/30
                       bg-cyan-300/10 font-semibold text-cyan-300"
        >
            {initial}
        </span>
    );
}

function RoleBadge({ role }) {
    let roleColors = "bg-white/10 text-gray-300";

    if (role === "SUPERADMIN") {
        roleColors = "bg-violet-400/15 text-violet-300";
    }

    return (
        <span
            className={`inline-block rounded-md px-2 py-1
                        text-[10px] font-bold tracking-wide ${roleColors}`}
        >
            {role}
        </span>
    );
}

function UserDirectory({
    view,
    rows,
    totalUsers,
    invalidRange,
    filters,
    pagination,
    onViewAll,
    onViewUser,
    onSearchChange,
    onRoleChange,
    onFromDateChange,
    onToDateChange,
    onSortChange,
    onToggleOrder,
    onClearFilters,
    onPageSizeChange,
    onPreviousPage,
    onNextPage
}) {
    const { search, role, from, to, sort, order } = filters;
    const { activePage, limit, totalPages } = pagination;

    let resultsLabel = "0 results";

    if (totalUsers > 0 && !invalidRange) {
        const firstResult = (activePage - 1) * limit + 1;
        const lastResult = Math.min(activePage * limit, totalUsers);

        resultsLabel = `${firstResult}–${lastResult} of ${totalUsers}`;
    }

    return (
        <section className={`${panelStyles} min-w-0 p-5`}>
            <div className="mb-5 flex items-center justify-between">
                <h2 className="font-semibold">
                    {view === "Overview" ? "Recent users" : "User directory"}
                </h2>
                {view === "Overview" ? (
                    <button
                        className="flex items-center gap-1 text-sm text-violet-400"
                        onClick={onViewAll}
                    >
                        View all
                        <ArrowUpRight size={16} />
                    </button>
                ) : (
                    <span className="text-xs text-gray-500">{totalUsers} accounts</span>
                )}
            </div>
            {view === "Users" && (
                <div className="mb-5 space-y-3">
                    <div className="flex flex-wrap gap-3">
                        <label className="relative min-w-48 flex-1">
                            <Search size={16} className="absolute left-3 top-3 text-gray-500" />
                            <input
                                aria-label="Search users"
                                placeholder="Search username, email or name…"
                                className={`${inputStyles} !pl-9`}
                                maxLength={100}
                                value={search}
                                onChange={onSearchChange}
                            />
                        </label>
                        <select
                            aria-label="Filter role"
                            className={`${inputStyles} !w-auto`}
                            value={role}
                            onChange={onRoleChange}
                        >
                            <option value="">All roles</option>
                            <option>USER</option>
                            <option>SUPERADMIN</option>
                        </select>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                        <label className="text-xs text-gray-500">
                            From date (UTC)
                            <input
                                type="date"
                                className={`${inputStyles} mt-1`}
                                value={from}
                                onChange={onFromDateChange}
                            />
                        </label>
                        <label className="text-xs text-gray-500">
                            To date (UTC)
                            <input
                                type="date"
                                className={`${inputStyles} mt-1`}
                                value={to}
                                onChange={onToDateChange}
                            />
                        </label>
                        <select
                            aria-label="Sort field"
                            className={`${inputStyles} !w-auto`}
                            value={sort}
                            onChange={onSortChange}
                        >
                            {["createdAt", "updatedAt", "username", "email", "role"].map(field => (
                                <option key={field} value={field}>
                                    {
                                        {
                                            createdAt: "Date created",
                                            updatedAt: "Date updated",
                                            username: "Username",
                                            email: "Email",
                                            role: "Role"
                                        }[field]
                                    }
                                </option>
                            ))}
                        </select>
                        <button className={buttonStyles} onClick={onToggleOrder}>
                            <ArrowUpDown size={15} />
                            {order === "asc" ? "Ascending" : "Descending"}
                        </button>
                        <button className={buttonStyles} onClick={onClearFilters}>
                            Clear filters
                        </button>
                    </div>
                    {invalidRange && (
                        <p role="alert" className="text-sm text-red-300">
                            The start date must be before the end date.
                        </p>
                    )}
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead className="text-gray-500">
                        <tr>
                            {["User", "Email", "Role", "Created", "Actions"].map(label => (
                                <th className="pb-3 font-normal" key={label}>
                                    {label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {!invalidRange &&
                            rows.map(user => (
                                <tr
                                    key={user.id}
                                    className="border-t border-white/10 hover:bg-violet-400/[.03]"
                                >
                                    <td className="py-3 pr-4">
                                        <div className="flex items-center gap-3">
                                            <UserAvatar user={user} />
                                            <div>
                                                <p className="font-semibold text-white">
                                                    {user.username}
                                                </p>
                                                <p className="mt-1 whitespace-nowrap text-gray-500">
                                                    {user.displayName || "No display name"}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="pr-4 text-gray-400">{user.email}</td>
                                    <td className="pr-4">
                                        <RoleBadge role={user.role} />
                                    </td>
                                    <td className="whitespace-nowrap pr-4 text-gray-400">
                                        {formatDate(user.createdAt)}
                                    </td>
                                    <td>
                                        <button
                                            className="rounded-md px-2 py-2 text-violet-300 hover:bg-violet-400/10"
                                            aria-label={`View ${user.username}`}
                                            onClick={() => onViewUser(user.id)}
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
                {(!rows.length || invalidRange) && (
                    <p className="py-12 text-center text-sm text-gray-500">
                        No users match these filters.
                    </p>
                )}
            </div>
            {view === "Users" && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-gray-500">
                    <span>{resultsLabel}</span>
                    <div className="flex items-center gap-2">
                        <select
                            aria-label="Users per page"
                            className={`${inputStyles} !w-auto !py-2 !text-xs`}
                            value={limit}
                            onChange={onPageSizeChange}
                        >
                            {[10, 20, 50, 100].map(n => (
                                <option key={n} value={n}>
                                    {n} / page
                                </option>
                            ))}
                        </select>
                        <button
                            aria-label="Previous page"
                            className={`${buttonStyles} !p-2`}
                            disabled={activePage === 1}
                            onClick={onPreviousPage}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span>
                            {activePage} / {totalPages}
                        </span>
                        <button
                            aria-label="Next page"
                            className={`${buttonStyles} !p-2`}
                            disabled={activePage === totalPages}
                            onClick={onNextPage}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}

export default UserDirectory;

export { UserAvatar, RoleBadge };
