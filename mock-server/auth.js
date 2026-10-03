let josePromise;
let publicKeyPromise;

async function getJose() {
    if (!josePromise) {
        josePromise = import("jose");
    }

    return josePromise;
}

async function getPublicKey() {
    if (!process.env.JWT_PUBLIC_KEY) {
        throw new Error("JWT public key is not configured");
    }

    if (!publicKeyPromise) {
        publicKeyPromise = (async () => {
            const { importSPKI } = await getJose();

            const publicKeyPEM =
                process.env.JWT_PUBLIC_KEY.replace(/\\n/g, "\n");

            return importSPKI(publicKeyPEM, "RS256");
        })();
    }

    return publicKeyPromise;
}

async function verifyAccessToken(token) {
    if (!token || typeof token !== "string") {
        throw new Error("Missing access token");
    }

    const { jwtVerify } = await getJose();
    const publicKey = await getPublicKey();

    const { payload } = await jwtVerify(token, publicKey, {
        algorithms: ["RS256"],
        issuer: "user-service",
        audience: "ft-transcendence-api"
    });

    if (typeof payload.sub !== "string" || !payload.sub) {
        throw new Error("Token is missing a valid user ID");
    }

    return {
        userId: payload.sub
    };
}

module.exports = { verifyAccessToken };
