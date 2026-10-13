import { afterEach, expect, test, vi } from "vitest";
import {
  AuthPrincipalClient,
  UnauthorizedError,
  VerificationUnavailableError,
} from "./auth-principal-client.js";

const VALID_UUID = "15f154f1-b37f-4fe7-955f-e8f4de3ceb8d";

let httpHits = 0;

function okBody(body: unknown): Response {
  return Response.json(body);
}

function stalledBody(signal: AbortSignal | null | undefined): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      signal?.addEventListener("abort", () => {
        controller.error((signal as AbortSignal).reason);
      });
    },
  });
}

vi.stubGlobal(
  "fetch",
  (async (_url: unknown, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const token = (headers.get("authorization") ?? "").replace(/^Bearer +/i, "");
    switch (token) {
      case "valid-token":
        httpHits += 1;
        return okBody({ userId: VALID_UUID, expiresAt: Date.now() + 60_000 });
      case "forged":
        httpHits += 1;
        return new Response("unauthorized", { status: 401 });
      case "slow-body":
        httpHits += 1;
        return new Response(stalledBody(init?.signal ?? null), { status: 200 });
      case "bad-uuid":
        return okBody({ userId: "not-a-uuid", expiresAt: Date.now() + 60_000 });
      case "bad-expiry-type":
        return okBody({ userId: VALID_UUID, expiresAt: "2030-01-01" });
      case "expired":
        return okBody({ userId: VALID_UUID, expiresAt: Date.now() - 1_000 });
      case "network-down":
        throw new TypeError("fetch failed");
      case "server-error":
        return new Response("boom", { status: 500 });
      case "not-json":
        return new Response("<html>nope</html>", { status: 200 });
      default:
        return new Response("unauthorized", { status: 401 });
    }
  }) as typeof fetch,
);

afterEach(() => {
  httpHits = 0;
});

test("verify: concurrent dedup then fresh sequential; body stall >2s is 503; malformed UUID/expiry is 503; 401 vs 503 split", async () => {
  const client = new AuthPrincipalClient("http://user-service:3000");

  const [a, b] = await Promise.all([client.verify("valid-token"), client.verify("valid-token")]);
  expect(a.userId).toBe(VALID_UUID);
  expect(a).toEqual(b);
  expect(httpHits).toBe(1);
  await client.verify("valid-token");
  expect(httpHits).toBe(2);

  await expect(client.verify("forged")).rejects.toBeInstanceOf(UnauthorizedError);

  const stallStart = Date.now();
  await expect(client.verify("slow-body")).rejects.toBeInstanceOf(VerificationUnavailableError);
  expect(Date.now() - stallStart).toBeGreaterThanOrEqual(1900);

  await expect(client.verify("bad-uuid")).rejects.toBeInstanceOf(VerificationUnavailableError);
  await expect(client.verify("bad-expiry-type")).rejects.toBeInstanceOf(VerificationUnavailableError);
  await expect(client.verify("expired")).rejects.toBeInstanceOf(VerificationUnavailableError);
  await expect(client.verify("network-down")).rejects.toBeInstanceOf(VerificationUnavailableError);
  await expect(client.verify("server-error")).rejects.toBeInstanceOf(VerificationUnavailableError);
  await expect(client.verify("not-json")).rejects.toBeInstanceOf(VerificationUnavailableError);
});
