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
import { seedUsers, stats, currentAdminId, validateProfile, protectLastAdmin } from "./mockService";
import {
    buttonStyles,
    primaryButtonStyles,
    inputStyles,
    panelStyles,
    formatDate
} from "./adminStyles";
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
            <div className="flex items-center gap-3 px- py-3">

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

function RegistrationChart({ users, windowDays, onWindowChange }) {
    // Each entry contains one date and the number of accounts created that day.
    const dailyRegistrations = [];

    for (let index = 0; index < windowDays; index++) {
        const day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - windowDays + 1 + index);

        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);

        const registeredUsers = users.filter(user => {
            const createdAt = new Date(user.createdAt);

            return createdAt >= day && createdAt < nextDay;
        });

        dailyRegistrations.push({
            day: day,
            count: registeredUsers.length
        });
    }

    const registrationCounts = dailyRegistrations.map(entry => entry.count);
    const maximumCount = Math.max(1, ...registrationCounts);
    const gridRows = [0, 1, 2, 3];
    const labelIndexes = [0, Math.floor((windowDays - 1) / 2), windowDays - 1];

    function getPointX(index) {
        return 35 + (index * 430) / (windowDays - 1);
    }

    function getPointY(count) {
        return 165 - (count / maximumCount) * 135;
    }

    function getPointCoordinates(entry, index) {
        const x = getPointX(index);
        const y = getPointY(entry.count);

        return `${x},${y}`;
    }

    const linePoints = dailyRegistrations.map(getPointCoordinates).join(" ");
    const areaPoints = `35,165 ${linePoints} 465,165`;

    function handleWindowChange(event) {
        onWindowChange(Number(event.target.value));
    }

    return (
        <section className={`${panelStyles} p-5`}>
            <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">New registrations</h2>

                <select
                    aria-label="Registration chart period"
                    className={`${inputStyles} !w-auto !text-xs`}
                    value={windowDays}
                    onChange={handleWindowChange}
                >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                </select>
            </div>

            <svg
                viewBox="0 0 500 205"
                className="mt-7 w-full"
                role="img"
                aria-label={`Daily registrations over the last ${windowDays} days`}
            >
                {gridRows.map(index => {
                    const y = 30 + index * 45;
                    const label = Math.round((maximumCount * (3 - index)) / 3);

                    return (
                        <g key={index}>
                            <line
                                x1="35"
                                x2="465"
                                y1={y}
                                y2={y}
                                stroke="#ffffff12"
                                strokeDasharray="3 5"
                            />
                            <text x="12" y={y + 4} fill="#9691a8" fontSize="10">
                                {label}
                            </text>
                        </g>
                    );
                })}

                <polygon points={areaPoints} fill="#a78bfa" fillOpacity=".1" />
                <polyline points={linePoints} fill="none" stroke="#a78bfa" strokeWidth="2.5" />

                {dailyRegistrations.map((entry, index) => (
                    <circle
                        key={index}
                        cx={getPointX(index)}
                        cy={getPointY(entry.count)}
                        r="3"
                        fill="#67e8f9"
                    >
                        <title>
                            {formatDate(entry.day)}: {entry.count} registrations
                        </title>
                    </circle>
                ))}

                {labelIndexes.map(index => {
                    const label = dailyRegistrations[index].day.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric"
                    });

                    return (
                        <text
                            key={index}
                            x={getPointX(index)}
                            y="190"
                            textAnchor="middle"
                            fill="#9691a8"
                            fontSize="10"
                        >
                            {label}
                        </text>
                    );
                })}
            </svg>

            <p className="mt-2 text-xs text-gray-500">Based on currently existing accounts.</p>
        </section>
    );
}

function AdminModal({ title, onClose, children }) {
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
            onCancel={onClose}
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
        { label: "Status (stored)", value: user.status },
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

function UserConfirmation({ user, kind, currentAdminId, onConfirm, onClose }) {
    let message;
    let confirmLabel;
    let confirmStyles = primaryButtonStyles;

    if (kind === "delete") {
        message = `Delete ${user.username}? This removes the user from this demo. This action cannot be undone.`;
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
                <button className={buttonStyles} onClick={onClose}>
                    Cancel
                </button>

                <button className={confirmStyles} onClick={onConfirm}>
                    {confirmLabel}
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

function AdminPanel() {
    // Account data and the current screen.
    const [users, setUsers] = useState(seedUsers);
    const [view, setView] = useState("Overview");
    const [signedOut, setSignedOut] = useState(false);

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
    const [windowDays, setWindowDays] = useState(7);

    const admin = users.find(user => user.id === currentAdminId);
    const counts = stats(users);

    let description = "Your account information and preferences.";

    if (view === "Overview") {
        description = "Manage your community and account permissions.";
    } else if (view === "Users") {
        description = "Search, review, and manage your community.";
    }
    const invalidRange = from && to && from > to;
    const filtered = getFilteredUsers();
    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    const activePage = Math.min(page, totalPages);
    const rows = getVisibleRows();

    let selected = null;

    if (modal?.id) {
        selected = users.find(user => user.id === modal.id);
    }

    function getFilteredUsers() {
        const matchingUsers = users.filter(user => {
            const matchesRole = !role || user.role === role;
            const searchValues = [user.username, user.email, user.displayName || ""];

            const matchesSearch = searchValues.some(value => {
                return value.toLowerCase().includes(search.toLowerCase());
            });

            const matchesStartDate = !from || user.createdAt >= `${from}T00:00:00.000Z`;
            const matchesEndDate = !to || user.createdAt <= `${to}T23:59:59.999Z`;

            return matchesRole && matchesSearch && matchesStartDate && matchesEndDate;
        });

        matchingUsers.sort(compareUsers);

        return matchingUsers;
    }

    function compareUsers(firstUser, secondUser) {
        const firstValue = String(firstUser[sort]);
        const secondValue = String(secondUser[sort]);
        let difference = firstValue.localeCompare(secondValue);

        if (order === "desc") {
            difference = -difference;
        }

        if (difference === 0) {
            return firstUser.id.localeCompare(secondUser.id);
        }

        return difference;
    }

    function getVisibleRows() {
        if (view === "Overview") {
            const newestUsers = [...users];

            newestUsers.sort((firstUser, secondUser) => {
                return secondUser.createdAt.localeCompare(firstUser.createdAt);
            });

            return newestUsers.slice(0, 5);
        }

        const startIndex = (activePage - 1) * limit;
        const endIndex = activePage * limit;

        return filtered.slice(startIndex, endIndex);
    }

    function closeModal() {
        setModal(null);
    }

    function openUserModal(kind, userId) {
        setModal({
            kind: kind,
            id: userId
        });
    }

    function openCreateForm() {
        setModal({ kind: "create" });
    }

    function openProfileForm() {
        openUserModal("edit", admin.id);
    }

    function dismissNotice() {
        setNotice("");
    }

    function navigateToView(destination) {
        setView(destination);
        setPage(1);
    }

    function handleLogOut() {
        setSignedOut(true);
    }

    function startDemoSession() {
        setUsers(seedUsers());
        setSignedOut(false);
        navigateToView("Overview");
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

    function saveUser(values) {
        const creating = modal.kind === "create";

        validateProfile(values, users, selected?.id, creating);

        const timestamp = new Date().toISOString();
        const profileFields = {
            username: values.username,
            email: values.email,
            firstName: values.firstName || null,
            lastName: values.lastName || null,
            displayName: values.displayName || null
        };

        if (creating) {
            const newUser = {
                ...profileFields,
                id: crypto.randomUUID(),
                role: values.role,
                avatarUrl: null,
                bannerUrl: null,
                status: "OFFLINE",
                emailVerifiedAt: null,
                createdAt: timestamp,
                updatedAt: timestamp
            };

            setUsers(previous => [...previous, newUser]);
            setNotice("User created successfully.");
        } else {
            setUsers(previous =>
                previous.map(user => {
                    if (user.id !== selected.id) {
                        return user;
                    }

                    let emailVerifiedAt = user.emailVerifiedAt;

                    if (values.email !== user.email) {
                        emailVerifiedAt = null;
                    }

                    return {
                        ...user,
                        ...profileFields,
                        emailVerifiedAt: emailVerifiedAt,
                        updatedAt: timestamp
                    };
                })
            );

            setNotice("Profile updated successfully.");
        }

        closeModal();
    }

    function changeUserRole() {
        try {
            let nextRole = "SUPERADMIN";

            if (selected.role === "SUPERADMIN") {
                protectLastAdmin(users, selected);
                nextRole = "USER";
            }

            setUsers(previous =>
                previous.map(user => {
                    if (user.id !== selected.id) {
                        return user;
                    }

                    return {
                        ...user,
                        role: nextRole,
                        updatedAt: new Date().toISOString()
                    };
                })
            );

            setNotice("Role updated successfully.");
            closeModal();
        } catch (error) {
            setNotice(error.message);
        }
    }

    function deleteUser() {
        try {
            protectLastAdmin(users, selected);

            setUsers(previous => previous.filter(user => user.id !== selected.id));
            setNotice("User deleted successfully.");
            closeModal();
        } catch (error) {
            setNotice(error.message);
        }
    }

    function renderModalContent() {
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
                currentAdminId={currentAdminId}
                onConfirm={handleConfirm}
                onClose={closeModal}
            />
        );
    }

    if (signedOut || !admin || admin.role !== "SUPERADMIN") {
        let heading = "Admin access removed";

        if (signedOut) {
            heading = "You are signed out";
        }

        return (
            <div className="admin-shell flex min-h-screen items-center justify-center p-6">
                <section className={`${panelStyles} max-w-md p-8 text-center`}>
                    <h1 className="text-2xl font-bold">{heading}</h1>
                    <p className="my-4 text-sm text-gray-400">
                        This is a local demonstration. Start a fresh demo session to restore the
                        sample accounts.
                    </p>
                    <button className={primaryButtonStyles} onClick={startDemoSession}>
                        Start demo session
                    </button>
                </section>
            </div>
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
                {view === "My profile" ? (
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
                        {view === "Overview" && (
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
                            {view === "Overview" && (
                                <RegistrationChart
                                    users={users}
                                    windowDays={windowDays}
                                    onWindowChange={setWindowDays}
                                />
                            )}
                            <UserDirectory
                                view={view}
                                rows={rows}
                                totalUsers={filtered.length}
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
                        {view === "Overview" && (
                            <section className={`${panelStyles} mt-5 p-5`}>
                                <h2 className="mb-4 font-semibold">Quick actions</h2>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {[
                                        ["Create user", UserPlus, openCreateForm],
                                        ["Browse users", Users, showUserDirectory],
                                        ["Edit my profile", UserRound, openProfileForm]
                                    ].map(([label, Icon, action]) => (
                                        <button
                                            key={label}
                                            className={`${buttonStyles} !justify-between !p-4`}
                                            onClick={action}
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
                    Preview environment · Mock data only
                </footer>
            </main>
            {modal && (
                <AdminModal title={modalTitles[modal.kind]} onClose={closeModal}>
                    {renderModalContent()}
                </AdminModal>
            )}
        </div>
    );
}

export default AdminPanel;
