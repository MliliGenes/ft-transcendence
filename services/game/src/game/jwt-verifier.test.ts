import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyAccessToken } from "./jwt-verifier.js";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

function makeToken(payloadOverrides: Record<string, unknown> = {}, signWith: crypto.KeyObject | string = privateKey): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const defaultPayload = {
    sub: "user-uuid-1234",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: "user-service",
    aud: "ft-transcendence-api",
  };
  const payload = Buffer.from(JSON.stringify({ ...defaultPayload, ...payloadOverrides })).toString("base64url");
  const sign = crypto.createSign("sha256");
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(signWith, "base64url");
  return `${header}.${payload}.${sig}`;
}

describe("verifyAccessToken", () => {
  it("verifies a valid RS256 token", () => {
    const token = makeToken();
    const result = verifyAccessToken(token, publicKeyPem);
    expect(result.sub).toBe("user-uuid-1234");
    expect(result.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it("rejects an expired token", () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) - 10 });
    expect(() => verifyAccessToken(token, publicKeyPem)).toThrow("Access token expired");
  });

  it("rejects a token signed with the wrong key", () => {
    const { privateKey: wrongKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const token = makeToken({}, wrongKey);
    expect(() => verifyAccessToken(token, publicKeyPem)).toThrow("Invalid token signature");
  });

  it("rejects an invalid issuer or audience", () => {
    const tokenBadIss = makeToken({ iss: "evil-service" });
    expect(() => verifyAccessToken(tokenBadIss, publicKeyPem)).toThrow("Invalid token issuer");

    const tokenBadAud = makeToken({ aud: "wrong-audience" });
    expect(() => verifyAccessToken(tokenBadAud, publicKeyPem)).toThrow("Invalid token audience");
  });

  it("rejects malformed token strings", () => {
    expect(() => verifyAccessToken("not-a-token", publicKeyPem)).toThrow("Invalid token format");
    expect(() => verifyAccessToken("a.b", publicKeyPem)).toThrow("Invalid token format");
  });
});
