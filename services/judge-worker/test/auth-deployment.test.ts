import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const settings = Object.fromEntries(["GITHUB", "DISCORD"].flatMap((provider) => [
  [`${provider}_CLIENT_ID`, `fixture-${provider.toLowerCase()}-id`],
  [`${provider}_CLIENT_SECRET`, `fixture-${provider.toLowerCase()}-secret`],
  [`${provider}_REDIRECT_URI`, `https://arena.fixture.test/api/auth/${provider.toLowerCase()}/callback`],
  [`${provider}_LINK_REDIRECT_URI`, `https://arena.fixture.test/api/auth/${provider.toLowerCase()}/link/callback`],
]));
function config(values: Record<string, string>) {
  return JSON.parse(execFileSync("docker", ["compose", "--env-file", ".env.example", "config", "--format", "json"], {
    cwd: root, env: { ...process.env, ...values }, encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
  })).services;
}
it("passes configured OAuth settings only to User Service", () => {
  const services = config(settings);
  for (const [key, value] of Object.entries(settings)) expect(services["user-service"].environment[key]).toBe(value);
  for (const name of ["game", "judge-worker", "nginx", "postgres", "user-db", "redis"])
    for (const key of Object.keys(settings)) expect(services[name].environment ?? {}).not.toHaveProperty(key);
});
it("defaults both login and link callbacks to the public API origin", () => {
  const values = Object.fromEntries(Object.keys(settings).map((key) => [key, ""]));
  const user = config({ ...values, AUTH_FRONTEND_URL: "https://arena.fixture.test" })["user-service"].environment;
  for (const provider of ["GITHUB", "DISCORD"]) {
    expect(user[`${provider}_REDIRECT_URI`]).toBe(`https://arena.fixture.test/api/auth/${provider.toLowerCase()}/callback`);
    expect(user[`${provider}_LINK_REDIRECT_URI`]).toBe(`https://arena.fixture.test/api/auth/${provider.toLowerCase()}/link/callback`);
    expect(user[`${provider}_CLIENT_ID`]).toBe("");
    expect(user[`${provider}_CLIENT_SECRET`]).toBe("");
  }
});
