import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { request } from "node:https";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
let name: string;
let port: number;
let started = false;
function docker(...args: string[]) { return execFileSync("docker", args, { encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "pipe"] }); }
function get(path: string, headers: Record<string, string> = {}, method = "POST") {
  return new Promise<number>((done, fail) => {
    const req = request({ host: "127.0.0.1", port, path, method, headers, rejectUnauthorized: false }, (response) => {
      response.resume(); response.on("end", () => done(response.statusCode!));
    });
    req.setTimeout(3000, () => req.destroy(new Error("owned gateway did not respond")));
    req.on("error", fail); req.end();
  });
}
beforeEach(async () => {
  name = `auth-repair-gateway-policy-${randomUUID().slice(0, 8)}`;
  started = false;
  // Own only this uniquely named container; the upstream loopback hosts have no service.
  docker("run", "--detach", "--rm", "--name", name, "--label", "codex.auth-repair=2026-10-13",
    "--publish", "127.0.0.1::443", "--add-host", "user-service:127.0.0.1", "--add-host", "game:127.0.0.1",
    "--volume", `${root}/infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro`,
    "--volume", `${root}/infra/nginx/certs:/etc/nginx/certs:ro`, "nginx:1.27-alpine");
  started = true;
  port = Number(docker("port", name, "443/tcp").trim().split(":").at(-1));
  await vi.waitFor(async () => expect(await get("/health", {}, "GET")).toBe(200));
}, 30_000);
afterEach(() => { if (started) docker("stop", name); });

it("protects case and trailing-slash forms of every cookie-changing route", async () => {
  for (const endpoint of ["login", "register", "refresh", "logout"]) {
    for (const path of [`/api/auth/${endpoint}`, `/api/auth/${endpoint}/`, `/API/AUTH/${endpoint.toUpperCase()}/`]) {
      expect(await get(path)).toBe(403);

    }
  }
  expect(await get("/api/auth/login", { Origin: "https://arena.fixture.test", "X-Requested-With": "arbitrary" })).toBe(403);
});
it.each([["login", 6], ["register", 6], ["refresh", 11], ["logout", 11]] as const)("shares the %s rate limit with alternate route forms", async (endpoint, allowed) => {
  const headers = { Origin: "https://arena.fixture.test", "X-Requested-With": "XMLHttpRequest" };
  // Consume the initial request and this endpoint's configured burst.
  for (let n = 0; n < allowed; n++) expect(await get(`/api/auth/${endpoint}`, headers)).toBe(502);
  expect(await get(`/API/AUTH/${endpoint.toUpperCase()}/`, headers)).toBe(503);
});
it("keeps query credentials in Referer out of access logs", async () => {
  const marker = `referer-fixture-${randomUUID()}`;
  expect(await get("/health", { Referer: `https://arena.fixture.test/account?credential=${marker}` }, "GET")).toBe(200);
  const logs = docker("logs", name);
  expect(logs).toContain('"GET /health HTTP/1.1"');
  expect(logs).not.toContain(marker);
});
