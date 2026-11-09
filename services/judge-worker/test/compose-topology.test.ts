import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const nginxConfig = readFileSync(resolve(repositoryRoot, "nginx/default.conf"), "utf8");

function composeConfig(): any {
  try {
    const rendered = execFileSync(
      "docker",
      ["compose", "config", "--format", "json"],
      { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    );
    return JSON.parse(rendered);
  } catch {
    throw new Error("Docker Compose configuration could not be rendered");
  }
}

function volumeTargets(service: any): string[] {
  return (service.volumes ?? []).map((volume: any) => typeof volume === "string" ? volume : volume.target);
}

describe("single-host judge Compose boundary", () => {
  it("gives the socket to judge-worker and keeps Game/Nginx off its network path", () => {
    const config = composeConfig();
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
    const config = composeConfig();
    const worker = config.services["judge-worker"];
    const game = config.services["game-service"];

    expect(game.environment.JUDGE_BACKEND).toBe("worker");
    expect(game.environment.JUDGE_WORKER_URL).toBe("http://judge-worker:3010");
    expect(game.depends_on["judge-worker"].condition).toBe("service_healthy");
    expect(worker.healthcheck).toBeDefined();
  });

  it("keeps credentials scoped and passes worker token", () => {
    const config = composeConfig();
    const game = config.services["game-service"];
    const worker = config.services["judge-worker"];

    expect(game.environment).toHaveProperty("JUDGE_WORKER_TOKEN");
    expect(game.environment).toHaveProperty("DATABASE_URL");
    expect(worker.environment).toHaveProperty("JUDGE_WORKER_TOKEN");
  });
});
