import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const nginxConfig = readFileSync(resolve(repositoryRoot, "nginx/default.conf"), "utf8");

function composeConfig(): any {
  try {
    execFileSync("docker", ["compose", "version", "--short"], { timeout: 5000, stdio: "pipe" });
  } catch {
    throw new Error("Docker Compose is required for topology checks. Install Docker Compose and make docker available on PATH.");
  }
  const fixture = mkdtempSync(join(tmpdir(), "nook-compose-topology-"));
  try {
    for (const name of ["compose.yaml", "compose.monitoring.yaml"]) {
      copyFileSync(resolve(repositoryRoot, name), join(fixture, name));
    }
    mkdirSync(join(fixture, "envs"));
    for (const name of readdirSync(resolve(repositoryRoot, "envs"))) {
      if (!name.endsWith(".env.example")) continue;
      copyFileSync(resolve(repositoryRoot, "envs", name), join(fixture, "envs", name.slice(0, -".example".length)));
    }
    writeFileSync(join(fixture, ".env"), "");
    const env = { ...process.env };
    for (const name of Object.keys(env)) if (name.startsWith("COMPOSE_")) delete env[name];
    const rendered = execFileSync("docker", [
      "compose", "--env-file", join(fixture, ".env"),
      "--project-directory", fixture, "-f", join(fixture, "compose.yaml"),
      "config", "--format", "json",
    ], { cwd: fixture, env, encoding: "utf8", timeout: 10000, maxBuffer: 4 * 1024 * 1024 });
    return JSON.parse(rendered);
  } catch (cause) {
    throw new Error("Cannot render the topology with the checked-in Compose files and example settings.", { cause });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

function volumeTargets(service: any): string[] {
  return (service.volumes ?? []).map((volume: any) => typeof volume === "string" ? volume : volume.target);
}

describe("single-host judge Compose boundary", () => {
  let config: any;
  beforeAll(() => { config = composeConfig(); });
  it("gives the socket to judge-worker and keeps Game/Nginx off its network path", () => {
    const worker = config.services["judge-worker"];
    const game = config.services["game-service"];
    const nginx = config.services.nginx;

    expect(worker).toBeDefined();
    expect(worker.ports ?? []).toEqual([]);
    expect(Object.keys(worker.networks ?? {})).toEqual(["judge-internal"]);
    expect(volumeTargets(worker)).toContain("/var/run/docker.sock");
    expect(volumeTargets(game)).not.toContain("/var/run/docker.sock");
    expect(worker.environment).not.toHaveProperty("POSTGRES_PASSWORD");
    expect(worker.environment).not.toHaveProperty("GAME_DB_PASSWORD");
    expect(Object.keys(game.networks ?? {})).toEqual(expect.arrayContaining(["default", "judge-internal"]));
    expect(config.networks["judge-internal"].internal).toBe(true);
    expect(nginx.depends_on?.["judge-worker"]).toBeUndefined();
    expect(nginx.ports).toBeDefined();
    expect(nginxConfig).not.toContain("judge-worker");
    expect(nginxConfig).toContain("matches|lobby");
    expect(nginxConfig).toContain("/api/game/socket.io/");
  });

  it("selects the worker explicitly and waits for its readiness before Game serves", () => {
    const worker = config.services["judge-worker"];
    const game = config.services["game-service"];

    expect(game.environment.JUDGE_BACKEND).toBe("worker");
    expect(game.environment.JUDGE_WORKER_URL).toBe("http://judge-worker:3010");
    expect(game.depends_on["judge-worker"].condition).toBe("service_healthy");
    expect(worker.healthcheck).toBeDefined();
  });

  it("keeps credentials scoped and passes worker token", () => {
    const game = config.services["game-service"];
    const worker = config.services["judge-worker"];

    expect(game.environment).toHaveProperty("JUDGE_WORKER_TOKEN");
    expect(game.environment).toHaveProperty("DATABASE_URL");
    expect(worker.environment).toHaveProperty("JUDGE_WORKER_TOKEN");
  });
});
