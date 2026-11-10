import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ALL_ROUND_PHASES } from "arena-model";
import * as net from "node:net";

const SERVICE = process.env.SERVICE_NAME ?? "game";

function tcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, host);
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function httpReady(baseUrl: string, timeoutMs: number): Promise<boolean> {
  let readyUrl: URL;
  try {
    readyUrl = new URL("/ready", baseUrl);
  } catch {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(readyUrl, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

@Controller()
export class HealthController {
  /** Liveness: the process is up and the shared model resolves at runtime. */
  @Get("health")
  health() {
    return { status: "ok", service: SERVICE, modelPhases: ALL_ROUND_PHASES.length };
  }

  /** Readiness: dependencies reachable over the compose network. No gameplay here. */
  @Get("ready")
  async ready() {
    let defaultPgHost = "game-db";
    if (process.env.DATABASE_URL) {
      try {
        defaultPgHost = new URL(process.env.DATABASE_URL).hostname;
      } catch {}
    }
    const pgHost = process.env.POSTGRES_HOST ?? defaultPgHost;
    const postgres = await tcp(pgHost, 5432, 500);
    const judgeWorkerUrl = process.env.JUDGE_WORKER_URL ?? "http://judge-worker:3010";
    const judgeWorker = await httpReady(judgeWorkerUrl, 500);
    const result = { ready: postgres && judgeWorker, checks: { postgres, judgeWorker } };
    if (!result.ready) throw new ServiceUnavailableException(result);
    return result;
  }
}
