const names = [
    "Alex Morgan",
    "Sarah Chen",
    "Omar Haddad",
    "Mia Parker",
    "Yassine Amrani",
    "Eva Martin",
    "Noah Wilson",
    "Lina Idrissi",
    "Adam Taylor",
    "Sofia Costa",
    "Leo Bernard",
    "Aya Benali"
];

const millisecondsPerDay = 86400000;

export const currentAdminId = "00000000-0000-4000-8000-000000000001";

export function seedUsers() {
    const now = Date.now();
    const users = [];

    for (let index = 0; index < 36; index++) {
        const fullName = names[index % names.length];
        const [firstName, lastName] = fullName.split(" ");
        const number = String(index + 1).padStart(2, "0");

        let username = `${firstName.toLowerCase()}_${number}`;
        let role = "USER";

        if (index === 0) {
            username = "admin";
        }

        if (index === 0 || index === 15) {
            role = "SUPERADMIN";
        }

        const daysAgo = index * 1.35 + 0.2;
        const createdAt = new Date(now - daysAgo * millisecondsPerDay).toISOString();
        let emailVerifiedAt = null;

        if (index % 3 !== 0) {
            emailVerifiedAt = createdAt;
        }

        users.push({
            id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
            username: username,
            email: `${username}@example.com`,
            role: role,
            firstName: firstName,
            lastName: lastName,
            displayName: fullName,
            avatarUrl: null,
            bannerUrl: null,
            status: "OFFLINE",
            emailVerifiedAt: emailVerifiedAt,
            createdAt: createdAt,
            updatedAt: createdAt
        });
    }

    return users;
}

export function stats(users, asOf = new Date()) {
    function countRecentUsers(days) {
        const windowStart = new Date(asOf.getTime() - days * millisecondsPerDay);

        const recentUsers = users.filter(user => {
            const createdAt = new Date(user.createdAt);

            return createdAt >= windowStart && createdAt <= asOf;
        });

        return recentUsers.length;
    }

    const regularUsers = users.filter(user => user.role === "USER");
    const superadmins = users.filter(user => user.role === "SUPERADMIN");

    return {
        totalUsers: users.length,
        regularUsers: regularUsers.length,
        superadmins: superadmins.length,
        newUsersLast7Days: countRecentUsers(7),
        newUsersLast30Days: countRecentUsers(30),
        asOf: asOf.toISOString()
    };
}

export function validateProfile(values, users, userId, creating) {
    if (values.username.length < 3 || values.username.length > 30) {
        throw new Error("Username must contain 3–30 characters.");
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(values.email)) {
        throw new Error("Enter a valid email address.");
    }

    const duplicateUser = users.find(user => {
        if (user.id === userId) {
            return false;
        }

        const sameEmail = user.email.toLowerCase() === values.email.toLowerCase();
        const sameUsername = user.username.toLowerCase() === values.username.toLowerCase();

        return sameEmail || sameUsername;
    });

    if (duplicateUser) {
        throw new Error("This username or email is already in use.");
    }

    if (creating) {
        const passwordLength = values.password.length;
        const passwordBytes = new TextEncoder().encode(values.password).length;

        if (passwordLength < 8 || passwordLength > 32 || passwordBytes > 72) {
            throw new Error("Password must contain 8–32 characters and at most 72 UTF-8 bytes.");
        }
    }

    const nameFields = ["firstName", "lastName", "displayName"];

    for (const field of nameFields) {
        if (values[field]?.length > 50) {
            throw new Error("Names must contain at most 50 characters.");
        }
    }
}

export function protectLastAdmin(users, user) {
    const superadmins = users.filter(account => account.role === "SUPERADMIN");

    if (user.role === "SUPERADMIN" && superadmins.length === 1) {
        throw new Error("The last superadmin cannot be deleted or demoted.");
    }
}
