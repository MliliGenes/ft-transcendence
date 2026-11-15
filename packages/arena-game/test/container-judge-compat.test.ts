import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ContainerJudge } from "../src/container-judge.js";
import { JudgeInfraError, SPIKE_LIMITS } from "../src/judge.js";

const LIMITS = { ...SPIKE_LIMITS, runWallMs: 4000, compileWallMs: 15000 };
const cleanupPaths: string[] = [];

afterEach(() => {
  while (cleanupPaths.length > 0) {
    const file = cleanupPaths.pop()!;
    try {
      unlinkSync(file);
    } catch {}
  }
});

function createArgCaptureScript(): { scriptPath: string; logPath: string } {
  const id = randomUUID();
  const scriptPath = join(tmpdir(), `mock-docker-capture-${id}.sh`);
  const logPath = join(tmpdir(), `mock-docker-capture-${id}.log`);
  cleanupPaths.push(scriptPath, logPath);

  // If rm cleanup command, exit immediately without waiting on stdin
  // For run commands, drain stdin to prevent EPIPE in child process stdio
  const script = `#!/bin/bash
if [ "$1" = "rm" ]; then exit 0; fi
cat > /dev/null
echo "$@" >> "${logPath}"
printf '{"status":"accepted","output_b64":"%s","comparison_b64":"%s","ms":10}\\n' "$(printf 'ok' | base64)" "$(printf '0' | base64)"
exit 0
`;
  writeFileSync(scriptPath, script, { mode: 0o755 });
  chmodSync(scriptPath, 0o755);
  return { scriptPath, logPath };
}

function createCpusRejectScript(): { scriptPath: string; logPath: string } {
  const id = randomUUID();
  const scriptPath = join(tmpdir(), `mock-docker-reject-${id}.sh`);
  const logPath = join(tmpdir(), `mock-docker-reject-${id}.log`);
  cleanupPaths.push(scriptPath, logPath);

  // Simulation fixture: drains bounded stdin, then reproduces school Ubuntu rootless daemon NanoCPUs rejection
  const script = `#!/bin/bash
if [ "$1" = "rm" ]; then exit 0; fi
cat > /dev/null
echo "$@" >> "${logPath}"
for arg in "$@"; do
  if [ "$arg" = "--cpus" ]; then
    echo "docker: Error response from daemon: NanoCPUs unsupported: host cgroup does not support cpus" >&2
    exit 125
  fi
done
printf '{"status":"accepted","output_b64":"%s","comparison_b64":"%s","ms":12}\\n' "$(printf 'ok' | base64)" "$(printf '0' | base64)"
exit 0
`;
  writeFileSync(scriptPath, script, { mode: 0o755 });
  chmodSync(scriptPath, 0o755);
  return { scriptPath, logPath };
}

describe("ContainerJudge cpuLimitEnabled compatibility and simulation", () => {
  it("strict default retains --cpus flag and full security/resource/isolation limits", async () => {
    const { scriptPath, logPath } = createArgCaptureScript();
    const judge = new ContainerJudge({ dockerBin: scriptPath });

    await judge.runVisible(
      "Python",
      "snippet",
      "def solve(nums): return 0",
      [{ id: "case-1", input: "nums = [1]", expected: "0" }],
      LIMITS,
    );

    const { readFileSync } = await import("node:fs");
    const loggedArgs = readFileSync(logPath, "utf8");

    // Strict default: --cpus must be present
    expect(loggedArgs).toContain("--cpus");
    expect(loggedArgs).toContain(String(LIMITS.runCpus));

    // Must retain other limits, security options, and isolation settings
    expect(loggedArgs).toContain("--network none");
    expect(loggedArgs).toContain(`--memory ${LIMITS.runMemoryMb}m`);
    expect(loggedArgs).toContain(`--memory-swap ${LIMITS.runMemoryMb}m`);
    expect(loggedArgs).toContain(`--pids-limit ${LIMITS.runPids}`);
    expect(loggedArgs).toContain("--cap-drop=ALL");
    expect(loggedArgs).toContain("--security-opt=no-new-privileges");
    expect(loggedArgs).toContain("--read-only");
    expect(loggedArgs).toContain("--label arena-judge-owned=true");
    expect(loggedArgs).toContain("--user nobody");
    expect(loggedArgs).toContain(`--tmpfs /scratch:rw,exec,size=${LIMITS.runMemoryMb}m,mode=1777`);
    expect(loggedArgs).toContain(`--tmpfs /tmp:rw,exec,size=${LIMITS.runMemoryMb}m,mode=1777`);
    expect(loggedArgs).toContain("--workdir /scratch");
  });

  it("explicit cpuLimitEnabled: false omits only --cpus while retaining all other limits", async () => {
    const { scriptPath, logPath } = createArgCaptureScript();
    const judge = new ContainerJudge({ dockerBin: scriptPath, cpuLimitEnabled: false });

    await judge.runVisible(
      "Python",
      "snippet",
      "def solve(nums): return 0",
      [{ id: "case-1", input: "nums = [1]", expected: "0" }],
      LIMITS,
    );

    const { readFileSync } = await import("node:fs");
    const loggedArgs = readFileSync(logPath, "utf8");

    // Explicit false: --cpus must NOT be present
    expect(loggedArgs).not.toContain("--cpus");

    // All other limits, security options, and isolation settings MUST remain present
    expect(loggedArgs).toContain("--network none");
    expect(loggedArgs).toContain(`--memory ${LIMITS.runMemoryMb}m`);
    expect(loggedArgs).toContain(`--memory-swap ${LIMITS.runMemoryMb}m`);
    expect(loggedArgs).toContain(`--pids-limit ${LIMITS.runPids}`);
    expect(loggedArgs).toContain("--cap-drop=ALL");
    expect(loggedArgs).toContain("--security-opt=no-new-privileges");
    expect(loggedArgs).toContain("--read-only");
    expect(loggedArgs).toContain("--label arena-judge-owned=true");
    expect(loggedArgs).toContain("--user nobody");
    expect(loggedArgs).toContain(`--tmpfs /scratch:rw,exec,size=${LIMITS.runMemoryMb}m,mode=1777`);
    expect(loggedArgs).toContain(`--tmpfs /tmp:rw,exec,size=${LIMITS.runMemoryMb}m,mode=1777`);
    expect(loggedArgs).toContain("--workdir /scratch");
  });

  it("simulation: rootless Docker rejecting --cpus raises typed JudgeInfraError under default strict mode", async () => {
    const { scriptPath } = createCpusRejectScript();
    const judge = new ContainerJudge({ dockerBin: scriptPath });

    await expect(
      judge.runVisible(
        "Python",
        "snippet",
        "def solve(nums): return 0",
        [{ id: "case-1", input: "nums = [1]", expected: "0" }],
        LIMITS,
      ),
    ).rejects.toThrow(JudgeInfraError);
  });

  it("simulation: explicit cpuLimitEnabled: false bypasses --cpus rejection and executes successfully", async () => {
    const { scriptPath } = createCpusRejectScript();
    const judge = new ContainerJudge({ dockerBin: scriptPath, cpuLimitEnabled: false });

    const results = await judge.runVisible(
      "Python",
      "snippet",
      "def solve(nums): return 0",
      [{ id: "case-1", input: "nums = [1]", expected: "0" }],
      LIMITS,
    );

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("accepted");
  });
});
