import { useState, useEffect, useRef } from "react";
import {
    LayoutDashboard,
    Users,
    UserRound,
    Shield,
    UserPlus,
    LogOut,
    X,
    Pencil,
    Trash2,
    ChevronRight
} from "lucide-react";
import { api, sessionStore } from "../lib/runtime.js";
import { navigate } from "../lib/navigation.js";
import { createAdminApi } from "./adminApi.js";

const adminApi = createAdminApi(api);
import { buttonStyles, primaryButtonStyles, panelStyles, formatDate } from "./adminStyles";
import UserDirectory, { UserAvatar, RoleBadge } from "./UserDirectory";
import UserForm from "./UserForm";
import nookLogo from "../assets/nook-logo.png";
import "./admin.css";
const navigationItems = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Users", icon: Users },
    { label: "My profile", icon: UserRound }
];

function AdminSidebar({ admin, view, onNavigate, onLogOut }) {
    function getNavigationStyles(label) {
        const baseStyles = [
            "flex items-center gap-3 rounded-xl border p-3.5",
            "text-left text-sm transition"
        ].join(" ");

        if (view === label) {
            return `${baseStyles} border-violet-400/20 bg-violet-400/10 text-violet-300`;
        }

        return `${baseStyles} border-transparent text-gray-400 hover:bg-white/5 hover:text-white`;
    }

    return (
        <aside
            className="flex flex-col border-b border-white/10 bg-[#100e19] p-5
                       lg:fixed lg:inset-y-0 lg:w-60 lg:border-r lg:border-b-0"
        >
            <div className="flex items-center gap-3 py-3">
                <div>
                    <img
                        src={nookLogo}
                        alt="Nook"
                        width={2172}
                        height={724}
                        className="block h-auto w-40 max-w-full object-contain"
                    />
                    <p className="mt-1 text-xs px-2 text-gray-500">Admin Panel</p>
                </div>
            </div>

            <nav className="mt-7 flex gap-2 lg:flex-col" aria-label="Admin navigation">
                {navigationItems.map(item => {
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.label}
                            onClick={() => onNavigate(item.label)}
                            className={getNavigationStyles(item.label)}
                        >
                            <Icon size={20} />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5 lg:mt-auto">
                <UserAvatar user={admin} />

                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{admin.username}</p>
                    <p className="text-xs text-gray-500">Superadmin</p>
                </div>

                <button
                    className="text-gray-400 hover:text-violet-300"
                    onClick={onLogOut}
                    aria-label="Log out"
                >
                    <LogOut size={19} />
                </button>
            </div>
        </aside>
    );
}

function RegistrationChart({ counts }) {
    const maximum = Math.max(1, counts.newUsersLast30Days, counts.newUsersLast7Days);
    const windows = [
        ["Last 7 days", counts.newUsersLast7Days],
        ["Last 30 days", counts.newUsersLast30Days]
    ];
    return (
        <section className={`${panelStyles} p-5`}>
            <h2 className="font-semibold">New registrations</h2>
            <div className="mt-7 space-y-6">
                {windows.map(([label, count]) => (
                    <div key={label}>
                        <div className="mb-2 flex justify-between text-sm">
                            <span>{label}</span>
                            <strong>{count}</strong>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-white/5">
                            <div
                                className="h-full rounded-full bg-violet-400"
                                style={{ width: `${(count / maximum) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
            <p className="mt-6 text-xs text-gray-500">
                Rolling windows ending at {new Date(counts.asOf).toLocaleString()}. The 7-day total
                is included in the 30-day total.
            </p>
        </section>
    );
}

function AdminModal({ title, onClose, children, pending }) {
    const dialogRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;

        dialog.showModal();

        return () => {
            dialog.close();
        };
    }, []);

    function handleBackdropClick(event) {
        if (event.target === event.currentTarget) {
            onClose();
        }
    }

    return (
        <dialog
            ref={dialogRef}
            onCancel={event => {
                event.preventDefault();
                onClose();
            }}
            onClick={handleBackdropClick}
            className="admin-dialog w-[min(94vw,560px)] rounded-2xl
                       border border-white/15 bg-[#151320] p-0 text-white"
        >
            <div className="flex items-center justify-between border-b border-white/10 p-5">
                <h2 className="text-xl font-semibold">{title}</h2>

                <button
                    autoFocus
                    onClick={onClose}
                    className={buttonStyles}
                    aria-label="Close dialog"
                    disabled={pending}
                >
                    <X size={18} />
                </button>
            </div>

            <div className="p-5">{children}</div>
        </dialog>
    );
}

function UserDetails({ user, onEdit, onChangeRole, onDelete }) {
    const details = [
        { label: "Email", value: user.email },
        { label: "Display name", value: user.displayName },
        { label: "First name", value: user.firstName },
        { label: "Last name", value: user.lastName },
        { label: "Email verification", value: user.emailVerifiedAt ? "Verified" : "Unverified" },
        { label: "Created", value: formatDate(user.createdAt) },
        { label: "Updated", value: formatDate(user.updatedAt) },
        { label: "ID", value: user.id }
    ];

    return (
        <>
            <div className="mb-5 flex items-center gap-3">
                <UserAvatar user={user} />

                <div>
                    <p className="font-semibold">{user.username}</p>
                    <RoleBadge role={user.role} />
                </div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
                {details.map(detail => (
                    <div key={detail.label}>
                        <dt className="text-xs text-gray-500">{detail.label}</dt>
                        <dd className="mt-1 break-all text-sm">{detail.value || "Not set"}</dd>
                    </div>
                ))}
            </dl>

            <div className="mt-6 flex flex-wrap gap-2">
                <button className={buttonStyles} onClick={onEdit}>
                    <Pencil size={15} />
                    Edit
                </button>

                <button className={buttonStyles} onClick={onChangeRole}>
                    <Shield size={15} />
                    Change role
                </button>

                <button className={`${buttonStyles} !text-red-300`} onClick={onDelete}>
                    <Trash2 size={15} />
                    Delete
                </button>
            </div>
        </>
    );
}

function UserConfirmation({ user, kind, currentAdminId, onConfirm, onClose, pending }) {
    let message;
    let confirmLabel;
    let confirmStyles = primaryButtonStyles;

    if (kind === "delete") {
        message = `Delete ${user.username}? This permanently removes the account and its associated authentication data. This action cannot be undone.`;
        confirmLabel = "Delete user";
        confirmStyles = `${buttonStyles} !border-red-400/50 !text-red-300`;
    } else {
        const nextRole = user.role === "USER" ? "SUPERADMIN" : "USER";

        message = `Change ${user.username} from ${user.role} to ${nextRole}?`;
        confirmLabel = "Confirm role change";
    }

    return (
        <>
            <p className="mb-5 text-sm leading-6 text-gray-300">
                {message}

                {user.id === currentAdminId && (
                    <span className="mt-2 block text-amber-300">
                        This is your account. You will lose admin access.
                    </span>
                )}
            </p>

            <div className="flex justify-end gap-2">
                <button className={buttonStyles} onClick={onClose} disabled={pending}>
                    Cancel
                </button>

                <button className={confirmStyles} onClick={onConfirm} disabled={pending}>
                    {pending ? "Saving…" : confirmLabel}
                </button>
            </div>
        </>
    );
}

const modalTitles = {
    create: "Create user",
    edit: "Edit profile",
    details: "User details",
    role: "Change role",
    delete: "Delete user"
};

function AdminPanel({ admin, onLogOut, onAccountChanged }) {
    // Account data and the current screen.
    const [data, setData] = useState({ users: [], total: 0, totalPages: 1, counts: null });
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [revision, setRevision] = useState(0);
    const [selected, setSelected] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [modalError, setModalError] = useState("");
    const [pending, setPending] = useState(false);
    const operationRef = useRef(false);
    const detailRequest = useRef(null);
    const [view, setView] = useState("Overview");

    // User directory filters, sorting, and pagination.
    const [search, setSearch] = useState("");
    const [role, setRole] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [sort, setSort] = useState("createdAt");
    const [order, setOrder] = useState("desc");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    // Popups, notifications, and the registration chart.
    const [modal, setModal] = useState(null);
    const [notice, setNotice] = useState("");

    const counts = data.counts;
    const rows = data.users;
    const invalidRange = Boolean(from && to && from > to);
    const totalPages = Math.max(1, data.totalPages);
    const activePage = page;
    let description = "Your account information and preferences.";
    if (view === "Overview") description = "Manage your community and account permissions.";
    if (view === "Users") description = "Search, review, and manage your community.";

    useEffect(() => {
        const controller = new AbortController();
        const sessionKey = sessionStore.read()?.sessionKey;
        async function load() {
            setLoading(true);
            setLoadError(null);
            if (view === "My profile" || invalidRange) {
                setLoading(false);
                return;
            }
            try {
                const filters =
                    view === "Overview"
                        ? { page: 1, limit: 5 }
                        : { search, role, from, to, sort, order, page, limit };
                const options = { signal: controller.signal };
                const [result, totals] = await Promise.all([
                    adminApi.users(filters, options),
                    view === "Overview" ? adminApi.stats(options) : Promise.resolve(null)
                ]);
                if (controller.signal.aborted || sessionStore.read()?.sessionKey !== sessionKey)
                    return;
                if (view === "Users" && result.page > Math.max(1, result.totalPages)) {
                    setPage(Math.max(1, result.totalPages));
                    return;
                }
                setData(previous => ({ ...result, counts: totals || previous.counts }));
            } catch (error) {
                if (!controller.signal.aborted) setLoadError(error);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        const timer = setTimeout(load, 200);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [view, search, role, from, to, sort, order, page, limit, invalidRange, revision]);

    useEffect(() => () => detailRequest.current?.abort(), []);

    function closeModal() {
        if (operationRef.current) return;
        detailRequest.current?.abort();
        setModal(null);
        setSelected(null);
        setModalError("");
    }

    async function openUserModal(kind, userId) {
        if (operationRef.current) return;
        detailRequest.current?.abort();
        const controller = new AbortController();
        detailRequest.current = controller;
        setSelected(null);
        setModal({ kind, id: userId });
        setModalError("");
        setDetailLoading(true);
        try {
            const user = await adminApi.user(userId, { signal: controller.signal });
            if (!controller.signal.aborted) setSelected(user);
        } catch (error) {
            if (!controller.signal.aborted) setModalError(error.message);
        } finally {
            if (!controller.signal.aborted) setDetailLoading(false);
        }
    }

    function openCreateForm() {
        setSelected(null);
        setDetailLoading(false);
        setModalError("");
        setModal({ kind: "create" });
    }

    function openProfileForm() {
        openUserModal("edit", admin.id);
    }

    function dismissNotice() {
        setNotice("");
    }

    function navigateToView(destination) {
        if (operationRef.current) return;
        setView(destination);
        setPage(1);
    }

    function handleLogOut() {
        if (!operationRef.current) void onLogOut();
    }

    function handleSearchChange(event) {
        setSearch(event.target.value);
        setPage(1);
    }

    function handleRoleFilterChange(event) {
        setRole(event.target.value);
        setPage(1);
    }

    function handleFromDateChange(event) {
        setFrom(event.target.value);
        setPage(1);
    }

    function handleToDateChange(event) {
        setTo(event.target.value);
        setPage(1);
    }

    function handleQuickAction(event) {
        if (pending) return;
        const action = event.currentTarget.dataset.action;
        if (action === "create") openCreateForm();
        if (action === "users") showUserDirectory();
        if (action === "profile") openProfileForm();
    }

    function showUserDirectory() {
        navigateToView("Users");
    }

    function handleViewUser(userId) {
        openUserModal("details", userId);
    }

    function handleSortChange(event) {
        setSort(event.target.value);
        setPage(1);
    }

    function toggleSortOrder() {
        if (order === "asc") {
            setOrder("desc");
        } else {
            setOrder("asc");
        }

        setPage(1);
    }

    function clearFilters() {
        setSearch("");
        setRole("");
        setFrom("");
        setTo("");
        setPage(1);
    }

    function handlePageSizeChange(event) {
        setLimit(Number(event.target.value));
        setPage(1);
    }

    function goToPreviousPage() {
        setPage(activePage - 1);
    }

    function goToNextPage() {
        setPage(activePage + 1);
    }

    async function performMutation(action, successMessage) {
        if (operationRef.current) return;
        operationRef.current = true;
        setPending(true);
        setModalError("");
        const sessionKey = sessionStore.read()?.sessionKey;
        try {
            const user = await action();
            if (!sessionKey || sessionStore.read()?.sessionKey !== sessionKey) {
                throw new Error("Your session changed. Reload your account before continuing.");
            }
            setLoading(true);
            setNotice(successMessage);
            setModal(null);
            setSelected(null);
            setRevision(previous => previous + 1);
            if (user?.id === admin.id) onAccountChanged(user);
            return user;
        } finally {
            operationRef.current = false;
            setPending(false);
        }
    }

    async function saveUser(values) {
        const creating = modal.kind === "create";
        return performMutation(
            () => (creating ? adminApi.create(values) : adminApi.update(selected, values)),
            creating ? "User created successfully." : "Profile updated successfully."
        );
    }

    async function changeUserRole() {
        try {
            const nextRole = selected.role === "SUPERADMIN" ? "USER" : "SUPERADMIN";
            await performMutation(
                () => adminApi.role(selected.id, nextRole),
                "Role updated successfully."
            );
        } catch (error) {
            setModalError(error.message);
        }
    }

    async function deleteUser() {
        const deletingSelf = selected.id === admin.id;
        try {
            await performMutation(() => adminApi.remove(selected.id), "User deleted successfully.");
            if (deletingSelf) await onLogOut();
        } catch (error) {
            setModalError(error.message);
        }
    }

    function renderModalContent() {
        if (detailLoading) return <p role="status">Loading user details…</p>;
        if (modalError && !selected && modal.kind !== "create")
            return (
                <p role="alert" className="text-red-300">
                    {modalError}
                </p>
            );
        if (modal.kind === "create" || modal.kind === "edit") {
            return (
                <UserForm
                    key={modal.id || "new"}
                    user={selected}
                    creating={modal.kind === "create"}
                    onSave={saveUser}
                    onClose={closeModal}
                />
            );
        }

        if (!selected) {
            return null;
        }

        if (modal.kind === "details") {
            return (
                <UserDetails
                    user={selected}
                    onEdit={() => openUserModal("edit", selected.id)}
                    onChangeRole={() => openUserModal("role", selected.id)}
                    onDelete={() => openUserModal("delete", selected.id)}
                />
            );
        }

        let handleConfirm = changeUserRole;

        if (modal.kind === "delete") {
            handleConfirm = deleteUser;
        }

        return (
            <UserConfirmation
                user={selected}
                kind={modal.kind}
                currentAdminId={admin.id}
                pending={pending}
                onConfirm={handleConfirm}
                onClose={closeModal}
            />
        );
    }

    return (
        <div className="admin-shell min-h-screen text-gray-100 lg:flex">
            <AdminSidebar
                admin={admin}
                view={view}
                onNavigate={navigateToView}
                onLogOut={handleLogOut}
            />
            <main className="min-w-0 flex-1 p-5 sm:p-8 lg:ml-60 xl:p-10">
                <header className="mb-9 flex items-center justify-between text-sm">
                    <button className="text-violet-300" onClick={() => navigate("/account")}>
                        Back to account
                    </button>
                    <p className="text-gray-500">
                        Admin <span className="mx-3">/</span>
                        <span className="text-gray-200">{view}</span>
                    </p>
                </header>
                <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{view}</h1>
                        <p className="mt-2 text-sm text-gray-400">{description}</p>
                    </div>
                    {view !== "My profile" && (
                        <button className={primaryButtonStyles} onClick={openCreateForm}>
                            <UserPlus size={18} />
                            Add user
                        </button>
                    )}
                </div>
                {notice && (
                    <div
                        role="status"
                        className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-violet-400/20 bg-violet-400/5 p-4 text-sm text-violet-200"
                    >
                        {notice}
                        <button aria-label="Dismiss notification" onClick={dismissNotice}>
                            <X size={16} />
                        </button>
                    </div>
                )}
                {loadError ? (
                    <section className={`${panelStyles} p-6`} role="alert">
                        <h2 className="font-semibold">
                            {loadError.status === 403
                                ? "Admin access is no longer available"
                                : "Could not load admin data"}
                        </h2>
                        <p className="mt-3 text-sm text-gray-300">{loadError.message}</p>
                        <div className="mt-4 flex gap-3">
                            <button
                                className={buttonStyles}
                                onClick={() => setRevision(value => value + 1)}
                            >
                                Try again
                            </button>
                            <button className={buttonStyles} onClick={() => navigate("/account")}>
                                Back to account
                            </button>
                        </div>
                    </section>
                ) : loading && view === "Overview" && !counts ? (
                    <p role="status" className="py-12 text-gray-400">
                        Loading admin data…
                    </p>
                ) : view === "My profile" ? (
                    <section className={`${panelStyles} max-w-3xl p-6`}>
                        <div className="mb-6 flex items-center gap-4">
                            <UserAvatar user={admin} />
                            <div>
                                <h2 className="text-lg font-semibold">
                                    {admin.displayName || admin.username}
                                </h2>
                                <RoleBadge role={admin.role} />
                            </div>
                        </div>
                        <dl className="grid gap-5 sm:grid-cols-2">
                            {[
                                ["Username", admin.username],
                                ["Email", admin.email],
                                ["First name", admin.firstName],
                                ["Last name", admin.lastName],
                                ["Created", formatDate(admin.createdAt)],
                                [
                                    "Email verification",
                                    admin.emailVerifiedAt ? "Verified" : "Unverified"
                                ]
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <dt className="text-xs text-gray-500">{label}</dt>
                                    <dd className="mt-1 break-all text-sm">{value || "Not set"}</dd>
                                </div>
                            ))}
                        </dl>
                        <button className={`${buttonStyles} mt-6`} onClick={openProfileForm}>
                            <Pencil size={16} />
                            Edit profile
                        </button>
                    </section>
                ) : (
                    <>
                        {view === "Overview" && counts && (
                            <>
                                <div className="mb-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                    {[
                                        ["Total users", counts.totalUsers, Users],
                                        ["Regular users", counts.regularUsers, UserRound],
                                        ["Superadmins", counts.superadmins, Shield],
                                        ["New users (7 days)", counts.newUsersLast7Days, UserPlus]
                                    ].map(([label, value, Icon]) => (
                                        <section
                                            key={label}
                                            className={`${panelStyles} flex items-center gap-4 p-5`}
                                        >
                                            <span className="rounded-xl bg-violet-400/10 p-3 text-violet-400">
                                                <Icon size={25} />
                                            </span>
                                            <div>
                                                <p className="text-xs text-gray-400">{label}</p>
                                                <p className="mt-1 text-3xl font-bold text-cyan-300">
                                                    {value}
                                                </p>
                                            </div>
                                        </section>
                                    ))}
                                </div>
                                <p className="mb-7 text-xs text-gray-500">
                                    {counts.newUsersLast30Days} registrations in the last 30 days ·
                                    As of {formatDate(counts.asOf)}
                                </p>
                            </>
                        )}
                        <div
                            className={
                                view === "Overview"
                                    ? "grid items-start gap-5 xl:grid-cols-[.85fr_1.15fr]"
                                    : ""
                            }
                        >
                            {view === "Overview" && counts && <RegistrationChart counts={counts} />}
                            <UserDirectory
                                view={view}
                                rows={invalidRange || loading ? [] : rows}
                                loading={loading}
                                totalUsers={invalidRange ? 0 : data.total}
                                invalidRange={invalidRange}
                                filters={{ search, role, from, to, sort, order }}
                                pagination={{ activePage, limit, totalPages }}
                                onViewAll={showUserDirectory}
                                onViewUser={handleViewUser}
                                onSearchChange={handleSearchChange}
                                onRoleChange={handleRoleFilterChange}
                                onFromDateChange={handleFromDateChange}
                                onToDateChange={handleToDateChange}
                                onSortChange={handleSortChange}
                                onToggleOrder={toggleSortOrder}
                                onClearFilters={clearFilters}
                                onPageSizeChange={handlePageSizeChange}
                                onPreviousPage={goToPreviousPage}
                                onNextPage={goToNextPage}
                            />
                        </div>
                        {view === "Overview" && counts && (
                            <section className={`${panelStyles} mt-5 p-5`}>
                                <h2 className="mb-4 font-semibold">Quick actions</h2>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {[
                                        ["Create user", UserPlus, "create"],
                                        ["Browse users", Users, "users"],
                                        ["Edit my profile", UserRound, "profile"]
                                    ].map(([label, Icon, action]) => (
                                        <button
                                            key={label}
                                            className={`${buttonStyles} !justify-between !p-4`}
                                            data-action={action}
                                            onClick={handleQuickAction}
                                        >
                                            <span className="flex items-center gap-3">
                                                <Icon size={20} className="text-violet-400" />
                                                {label}
                                            </span>
                                            <ChevronRight size={16} />
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}
                <footer className="mt-7 text-right text-xs text-gray-600">
                    User service · Live account data
                </footer>
            </main>
            {modal && (
                <AdminModal title={modalTitles[modal.kind]} onClose={closeModal} pending={pending}>
                    {modalError && selected && (
                        <p role="alert" className="mb-4 text-sm text-red-300">
                            {modalError}
                        </p>
                    )}
                    {renderModalContent()}
                </AdminModal>
            )}
        </div>
    );
}

export default AdminPanel;
