import { RequestMethod } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { HealthController } from "../health.controller.js";
import {
  AuthPrincipalClient,
  UnauthorizedError,
  VerificationUnavailableError,
} from "../auth/auth-principal-client.js";
import { createTestAppWithVerifier } from "../auth/test-helpers.js";
import type { INestApplication } from "@nestjs/common";
import { GameController } from "./game.controller.js";
import { GameService } from "./game.service.js";
import { LobbyController } from "./lobby.controller.js";
import { PrincipalMiddleware } from "./principal.js";
import { GameRuntimeInterceptor } from "./runtime-availability.interceptor.js";

// ponytail: production-auth HTTP test. Real GameService cannot init with
// DEV_PRINCIPAL=false + empty DATABASE_URL, so GameService is a fake
// (TEST_PG_URL-or-fake-Game rule); the verifier fake stands in for
// user-service GET /auth/principal. Middleware scoping below mirrors
// GameModule (Task 4 owns the registration there).
const VERIFIED = "15f154f1-b37f-4fe7-955f-e8f4de3ceb8d";
const VICTIM = "6b9d0f8a-7c1e-4b2d-9a3f-0c4e5d6f7a8b";
const EXPIRES_AT = Date.now() + 60_000;

function fakeVerify(accessToken: string) {
  switch (accessToken) {
    case "valid-token":
      return Promise.resolve({ userId: VERIFIED, expiresAt: EXPIRES_AT });
    case "outage-token":
      return Promise.reject(new VerificationUnavailableError());
    default:
      return Promise.reject(new UnauthorizedError());
  }
}

const fakeGame = {
  runtimeReady: true,
  assertServing: () => {},
  snapshot: async (userId: string) => ({ actedAs: userId }),
  submit: async (userId: string) => ({ ok: true, actedAs: userId }),
  createMatch: async () => ({ matchId: "m-fixture" }),
};

describe("game HTTP Bearer authentication (task 4)", () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    delete process.env.DEV_PRINCIPAL;
    const built = await createTestAppWithVerifier(fakeVerify, {
      controllers: [GameController, LobbyController, HealthController],
      providers: [
        { provide: GameService, useValue: fakeGame },
        GameRuntimeInterceptor,
        PrincipalMiddleware,
      ],
      applyMiddleware: (consumer) =>
        consumer.apply(PrincipalMiddleware).forRoutes(
          { path: "matches", method: RequestMethod.ALL },
          { path: "matches/{*path}", method: RequestMethod.ALL },
          { path: "lobby", method: RequestMethod.ALL },
          { path: "lobby/{*path}", method: RequestMethod.ALL },
        ),
    });
    app = built.app;
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  async function api(
    method: string,
    path: string,
    headers: Record<string, string> = {},
    body?: unknown,
  ): Promise<{ status: number; json: unknown }> {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  it("missing/malformed/forged/expired/deleted tokens are 401; outage is 503", async () => {
    expect((await api("GET", "/matches/x/snapshot")).status).toBe(401);
    expect(
      (await api("GET", "/matches/x/snapshot", { authorization: "Token abc" })).status,
    ).toBe(401);
    expect(
      (await api("GET", "/matches/x/snapshot", { authorization: "Bearer" })).status,
    ).toBe(401);
    expect(
      (await api("GET", "/matches/x/snapshot", { authorization: "Bearer forged" })).status,
    ).toBe(401);
    expect(
      (await api("GET", "/matches/x/snapshot", { authorization: "Bearer expired-token" })).status,
    ).toBe(401);
    expect(
      (await api("GET", "/matches/x/snapshot", { authorization: "Bearer deleted-token" })).status,
    ).toBe(401);
    expect(
      (await api("GET", "/matches/x/snapshot", { authorization: "Bearer outage-token" })).status,
    ).toBe(503);
  });

  it("acts as the verified principal, never the body userId", async () => {
    const snap = await api("GET", "/matches/x/snapshot", {
      authorization: "Bearer valid-token",
    });
    expect(snap.status).toBe(200);
    expect(snap.json).toEqual({ actedAs: VERIFIED });
    const submit = await api(
      "POST",
      "/matches/x/submit",
      { authorization: "Bearer valid-token" },
      { userId: VICTIM, code: "1", language: "python" },
    );
    expect(submit.status).toBe(201);
    expect(submit.json).toEqual({ ok: true, actedAs: VERIFIED });
  });

  it("dev-fixture header/query identity fails with DEV disabled", async () => {
    expect(
      (await api("GET", "/matches/x/snapshot", { "x-dev-user-id": VICTIM })).status,
    ).toBe(401);
    expect((await api("GET", `/matches/x/snapshot?userId=${VICTIM}`)).status).toBe(401);
    expect((await api("GET", `/matches/x/snapshot?user=${VICTIM}`)).status).toBe(401);
    expect((await api("GET", "/lobby/active", { "x-dev-user-id": VICTIM })).status).toBe(
      401,
    );
  });

  it("lobby routes are guarded the same way", async () => {
    expect((await api("GET", "/lobby/active")).status).toBe(401);
  });

  it("internal probes stay exempt", async () => {
    expect((await api("GET", "/health")).status).toBe(200);
    // /ready needs postgres+redis+runtime; without them it is 503 — the point
    // is it must never be 401 (no credentials required).
    expect((await api("GET", "/ready")).status).not.toBe(401);
  });

  it("POST /matches still 404 unless the dev fixture is on", async () => {
    const body = { mode: "1v1", participants: [], problemVersionIds: [] };
    expect(
      (await api("POST", "/matches", { authorization: "Bearer valid-token" }, body)).status,
    ).toBe(404);
    vi.stubEnv("DEV_PRINCIPAL", "true");
    try {
      expect(
        (await api("POST", "/matches", { authorization: "Bearer valid-token" }, body)).status,
      ).toBe(201);
    } finally {
      delete process.env.DEV_PRINCIPAL;
    }
  });

  it("middleware sets { userId, expiresAt } from the verifier", async () => {
    const verifier = app.get(AuthPrincipalClient);
    const middleware = new PrincipalMiddleware(verifier);
    const req = {
      method: "GET",
      path: "/matches/x/snapshot",
      header: (name: string) =>
        name.toLowerCase() === "authorization" ? "Bearer valid-token" : undefined,
    } as unknown as Parameters<PrincipalMiddleware["use"]>[0];
    let status = 0;
    const res = {
      status: (code: number) => ((status = code), { json: () => {} }),
    } as unknown as Parameters<PrincipalMiddleware["use"]>[1];
    let nexted = false;
    await middleware.use(req, res, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
    expect(status).toBe(0);
    expect(req.principal).toEqual({ userId: VERIFIED, expiresAt: EXPIRES_AT });
  });
});
