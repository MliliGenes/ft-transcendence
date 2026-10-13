import { afterEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContainerJudge, Judge0Adapter, JudgeInfraError, SPIKE_LIMITS, type GameJudge, type Judge0HttpClient } from "../src/judge.js";
import { setup, SOLVED_PY } from "./setup.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function loggedDocker(realDocker = false, logRun = true) {
  const directory = mkdtempSync(join(tmpdir(), "arena-diagnosis-judge-"));
  directories.push(directory);
  const binary = join(directory, "fake-docker");
  const log = join(directory, "calls.jsonl");
  const quotedLog = "'" + log.replaceAll("'", "'\\''") + "'";
  writeFileSync(binary, `#!/bin/sh
name=''
previous=''
for argument in "$@"; do
  if [ "$previous" = '--name' ]; then name="$argument"; fi
  previous="$argument"
done
if [ "$1" = 'rm' ]; then name="$3"; fi
if [ "$1" != 'run' ] || [ '${logRun ? "1" : "0"}' = '1' ]; then
  printf '["%s","%s"]\\n' "$1" "$name" >> ${quotedLog}
fi
${realDocker ? 'exec /usr/local/bin/docker "$@"' : 'if [ "$1" = "run" ]; then exec /bin/sleep 10; fi'}
`);
  chmodSync(binary, 0o755);
  return { binary, calls: () => existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line) as string[]) : [] };
}

function provider(stdout: string, stderr = ""): Judge0HttpClient {
  return {
    createSubmission: async () => ({ token: "fixture-token" }),
    getSubmission: async () => ({ status: { id: 3 }, stdout, stderr, time: "0.001" }),
  };
}

function successfulJudge(consumeMetrics?: GameJudge["consumeMetrics"]): GameJudge {
  return {
    runVisible: async () => [],
    consumeMetrics,
    evaluateSealed: async (request) => ({ groups: request.groups.map((group) => ({
      name: group.name, weight: group.weight,
      results: group.tests.map((test) => ({ id: test.id, passed: true, status: "accepted", runtimeMs: 1 })),
    })) }),
  };
}

describe("evaluation and judge contract diagnosis", () => {
  it.each(["sink", "metrics"])("a %s telemetry failure does not discard a completed evaluation", async (failureAt) => {
    const fail = () => { throw new Error("telemetry is unavailable"); };
    const f = await setup([], {
      judge: successfulJudge(failureAt === "metrics" ? fail : undefined),
      telemetry: { record: failureAt === "sink" ? fail : () => {} },
    });
    await expect(f.engine.submit(f.left, f.matchId, { code: SOLVED_PY, language: "Python" })).resolves.toMatchObject({ ok: true });
    expect((await f.engine.snapshot(f.left, f.matchId)).sides.left?.submissions).toBe(1);
  });

  it("preserves the judge error when telemetry also fails", async () => {
    const judgeError = new JudgeInfraError("judge is unavailable");
    const f = await setup([], {
      judge: { runVisible: async () => [], evaluateSealed: async () => { throw judgeError; } },
      telemetry: { record: () => { throw new Error("telemetry is unavailable"); } },
    });
    await expect(f.engine.submit(f.left, f.matchId, { code: SOLVED_PY, language: "Python" })).rejects.toBe(judgeError);
    expect((await f.engine.snapshot(f.left, f.matchId)).sides.left?.submissions).toBe(0);
  });

  it.each([true, false])("a container client timeout raises an infrastructure error and attempts cleanup (run log: %s)", async (logRun) => {
    const docker = loggedDocker(false, logRun);
    const judge = new ContainerJudge({ dockerBin: docker.binary, outerTimeoutMs: 500 });
    await expect(judge.runVisible("Python", "snippet", "def solve(value): return value", [
      { id: "case", input: "value = 1", expected: "1" },
    ], SPIKE_LIMITS)).rejects.toBeInstanceOf(JudgeInfraError);
    const calls = docker.calls();
    const runs = calls.filter((args) => args[0] === "run");
    const cleanup = calls.filter((args) => args[0] === "rm");
    // The host can stop the run client before the fixture records startup.
    // Cleanup must still finish before the caller receives the timeout.
    expect(runs.length).toBeLessThanOrEqual(1);
    expect(cleanup).toHaveLength(1);
    expect(cleanup[0]?.[1]).toMatch(/^arena-judge-[a-f0-9-]+$/);
    if (runs[0]) expect(cleanup[0]).toEqual(["rm", runs[0][1]]);
    expect(calls).toHaveLength(runs.length + 1);
  });

  it.each([
    { stdout: "x".repeat(64), stderr: "", expected: "x".repeat(64), status: "accepted", passed: true },
    { stdout: "x".repeat(65), stderr: "", expected: "x".repeat(65), status: "output_limit_exceeded", passed: false },
    { stdout: "é".repeat(33), stderr: "", expected: "é".repeat(33), status: "output_limit_exceeded", passed: false },
    { stdout: "x".repeat(64), stderr: "x", expected: "x".repeat(64), status: "output_limit_exceeded", passed: false },
  ])("Judge0 enforces the UTF8 byte cap for $status", async ({ stdout, stderr, expected, status, passed }) => {
    const judge = new Judge0Adapter({ http: provider(stdout, stderr) });
    const [result] = await judge.runVisible("Python", "stdio", "fixture source", [
      { id: "case", input: "", expected },
    ], { ...SPIKE_LIMITS, runOutputBytes: 64 });
    expect(result).toMatchObject({ passed, status });
    expect(Buffer.byteLength(result!.output, "utf8")).toBeLessThanOrEqual(64);
  });

  it("Judge0 counts snippet comparison and display bytes together", async () => {
    const stdout = JSON.stringify({ result: "x".repeat(32), output: "x".repeat(33) });
    const judge = new Judge0Adapter({ http: provider(stdout) });
    const result = await judge.evaluateSealed({
      evaluationId: "evaluation", submissionId: "submission", problemVersionId: "problem", hiddenSuiteId: "hidden",
      language: "Python", driver: "snippet", source: "fixture source",
      groups: [{ name: "hidden", weight: 100, tests: [{ id: "case", input: "value = 1", expected: "x".repeat(32) }] }],
      limits: { ...SPIKE_LIMITS, runOutputBytes: 64 },
    });
    expect(result.groups[0]?.results[0]).toMatchObject({ passed: false, status: "output_limit_exceeded" });
    expect(JSON.stringify(result)).not.toContain('"output":');
  });

  it.skipIf(process.env.ARENA_DIAGNOSIS_DOCKER !== "1")("reaps a real container when only the Docker client times out", async () => {
    const dockerBin = "/usr/local/bin/docker";
    const command = (args: string[]) => new Promise<string>((resolve, reject) => {
      execFile(dockerBin, args, { timeout: 5000 }, (error, stdout) => error ? reject(error) : resolve(stdout));
    });
    const names = async (name: string) => (await command(["ps", "-a", "--filter", `name=${name}`, "--format", "{{.Names}}"]))
      .trim().split("\n").filter(Boolean);
    const docker = loggedDocker(true);
    const judge = new ContainerJudge({ dockerBin: docker.binary, outerTimeoutMs: 3000 });
    const pending = judge.runVisible("Python", "snippet", "def solve(value):\n    while True: pass\n", [
      { id: "case", input: "value = 1", expected: "1" },
    ], { ...SPIKE_LIMITS, runWallMs: 30000 });
    pending.catch(() => {});
    let ownedName: string | undefined;
    try {
      for (let attempt = 0; attempt < 15 && !ownedName; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        ownedName = docker.calls().find((args) => args[0] === "run")?.[1];
      }
      expect(ownedName).toMatch(/^arena-judge-[a-f0-9-]+$/);
      let observedRunning = false;
      for (let attempt = 0; attempt < 15 && !observedRunning; attempt++) {
        observedRunning = (await names(ownedName!)).includes(ownedName!);
        if (!observedRunning) await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(observedRunning).toBe(true);
      await expect(pending).rejects.toThrow("judge orchestrator timeout");
      expect(await names(ownedName!)).not.toContain(ownedName);
    } finally {
      await pending.catch(() => {});
      if (ownedName && (await names(ownedName)).includes(ownedName)) await command(["rm", "-f", ownedName]);
    }
  }, 20000);
});
