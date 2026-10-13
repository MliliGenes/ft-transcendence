import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io";
import {
  attachSocketPrincipal,
  authenticateHandshake,
  authorizeSocketMessage,
  canEmitTo,
  principalFromHandshake,
  requireSocketPrincipal,
  socketPrincipal,
} from "./socket-auth.js";
import { UnauthorizedError } from "../auth/auth-principal-client.js";

function fakeSocket(
  auth: Record<string, unknown> = {},
  query: Record<string, unknown> = {},
  data: Record<string, unknown> = {},
): Socket {
  return { handshake: { auth, query }, data } as unknown as Socket;
}

describe("socket authorization context", () => {
  beforeEach(() => {
    vi.stubEnv("DEV_PRINCIPAL", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads one trusted identity from auth and accepts an equivalent query fallback", () => {
    const client = fakeSocket({ userId: "alice", matchId: "match-1" }, { userId: "alice", matchId: "match-1" });

    expect(principalFromHandshake(client, { matchIdRequired: true })).toEqual({
      userId: "alice",
      matchId: "match-1",
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
  });

  it("supports user-only lobby handshakes while requiring Match identity for Match namespaces", () => {
    const client = fakeSocket({}, { userId: "alice" });

    expect(principalFromHandshake(client)).toEqual({ userId: "alice", expiresAt: Number.MAX_SAFE_INTEGER });
    expect(() => principalFromHandshake(client, { matchIdRequired: true })).toThrow("missing socket matchId");
  });

  it("fails closed on conflicting identity sources or disabled development auth", () => {
    expect(() => principalFromHandshake(fakeSocket({ userId: "alice" }, { userId: "mallory" }))).toThrow(
      "conflicting socket userId",
    );
    vi.stubEnv("DEV_PRINCIPAL", "false");
    expect(() => principalFromHandshake(fakeSocket({ userId: "alice" }))).toThrow("authentication required");
  });

  it("attaches and requires the verified principal without trusting raw client fields", () => {
    const client = fakeSocket();
    expect(socketPrincipal(client)).toBeNull();

    attachSocketPrincipal(client, { userId: "alice", matchId: "match-1", expiresAt: Number.MAX_SAFE_INTEGER });
    expect(requireSocketPrincipal(client, { matchIdRequired: true })).toEqual({
      userId: "alice",
      matchId: "match-1",
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
    expect(requireSocketPrincipal(client)).toEqual({
      userId: "alice",
      matchId: "match-1",
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
  });

  it("stores the access token privately; attach keeps { userId, expiresAt, matchId } only", async () => {
    const expiresAt = Date.now() + 60_000;
    const verifier = { verify: async (t: string) => {
      expect(t).toBe("valid-token");
      return { userId: "alice", expiresAt };
    } };
    const client = fakeSocket({ accessToken: "valid-token", matchId: "match-1" });
    const principal = await authenticateHandshake(client, verifier as never, { matchIdRequired: true });
    expect(principal).toEqual({ userId: "alice", expiresAt, matchId: "match-1" });
    // Token stored privately, never merged into the principal.
    expect((client.data as Record<string, unknown>).accessToken).toBe("valid-token");
    expect(socketPrincipal(client)).toEqual({ userId: "alice", expiresAt, matchId: "match-1" });
    expect("accessToken" in (socketPrincipal(client) as unknown as Record<string, unknown>)).toBe(false);
  });

  it("per-message re-verifies the stored token and checks userId equality", async () => {
    const expiresAt = Date.now() + 60_000;
    const client = fakeSocket({ accessToken: "valid-token", matchId: "m" });
    await authenticateHandshake(client, { verify: async () => ({ userId: "alice", expiresAt }) } as never);
    // Same user, fresh expiry: passes and refreshes.
    const authed = await authorizeSocketMessage(
      client,
      { verify: async (t: string) => {
        expect(t).toBe("valid-token");
        return { userId: "alice", expiresAt: expiresAt + 1000 };
      } } as never,
      { matchIdRequired: true },
    );
    expect(authed.userId).toBe("alice");
    // Mismatch disconnects.
    const mismatch = fakeSocket({ accessToken: "valid-token", matchId: "m" });
    await authenticateHandshake(mismatch, { verify: async () => ({ userId: "alice", expiresAt }) } as never);
    let disconnected = false;
    (mismatch as unknown as Record<string, unknown>).disconnect = () => { disconnected = true; };
    await expect(
      authorizeSocketMessage(mismatch, { verify: async () => ({ userId: "mallory", expiresAt }) } as never),
    ).rejects.toThrow();
    expect(disconnected).toBe(true);
    // Deleted-between-messages disconnects.
    const deleted = fakeSocket({ accessToken: "valid-token", matchId: "m" });
    await authenticateHandshake(deleted, { verify: async () => ({ userId: "alice", expiresAt }) } as never);
    let deletedDisc = false;
    (deleted as unknown as Record<string, unknown>).disconnect = () => { deletedDisc = true; };
    await expect(
      authorizeSocketMessage(deleted, { verify: async () => { throw new UnauthorizedError(); } } as never),
    ).rejects.toThrow();
    expect(deletedDisc).toBe(true);
  });

  it("token replacement via payload is rejected; fixture userId/query fails DEV-disabled", async () => {
    const expiresAt = Date.now() + 60_000;
    const client = fakeSocket({ accessToken: "valid-token", matchId: "m" });
    await authenticateHandshake(client, { verify: async () => ({ userId: "alice", expiresAt }) } as never);
    // A forged payload must never overwrite the stored token or principal.
    const before = (client.data as Record<string, unknown>).accessToken;
    await authorizeSocketMessage(client, { verify: async (t: string) => {
      expect(t).toBe("valid-token");
      return { userId: "alice", expiresAt };
    } } as never);
    expect((client.data as Record<string, unknown>).accessToken).toBe(before);
    expect(socketPrincipal(client)?.userId).toBe("alice");
    // DEV-disabled: handshake userId/query fixtures fail closed.
    vi.stubEnv("DEV_PRINCIPAL", "false");
    await expect(
      authenticateHandshake(fakeSocket({ userId: "alice", matchId: "m" }), undefined),
    ).rejects.toThrow("authentication required");
    await expect(
      authenticateHandshake(fakeSocket({}, { userId: "alice" }), undefined),
    ).rejects.toThrow("authentication required");
  });

  it("tokenless per-message auth fails closed with DEV off", async () => {
    const client = fakeSocket();
    attachSocketPrincipal(client, { userId: "alice", expiresAt: Date.now() + 60_000 });
    let disconnected = false;
    (client as unknown as Record<string, unknown>).disconnect = () => { disconnected = true; };
    vi.stubEnv("DEV_PRINCIPAL", "false");
    await expect(authorizeSocketMessage(client, undefined)).rejects.toThrow("authentication required");
    expect(disconnected).toBe(true);
  });

  it("expiry gates emission per recipient", async () => {
    const live = fakeSocket();
    attachSocketPrincipal(live, { userId: "a", expiresAt: Date.now() + 60_000 });
    (live as unknown as Record<string, unknown>).connected = true;
    expect(canEmitTo(live, true)).toBe(true);
    expect(canEmitTo(live, false)).toBe(false);
    const expired = fakeSocket();
    attachSocketPrincipal(expired, { userId: "a", expiresAt: Date.now() - 1000 });
    (expired as unknown as Record<string, unknown>).connected = true;
    expect(canEmitTo(expired, true)).toBe(false);
  });
});
