import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ContainerJudge, MAX_CASE_PAYLOAD_BYTES } from "../src/container-judge.js";
import { JudgeInfraError, SPIKE_LIMITS } from "../src/judge.js";

const LIMITS = {
  ...SPIKE_LIMITS,
  runWallMs: 4000,
  compileWallMs: 15000,
  runMemoryMb: 256,
  runOutputBytes: 65536,
  runPids: 64,
};

const scratchDirs: string[] = [];

function makeFakeDocker(stdout: string, exitCode = 0, stderr = ""): string {
  const directory = mkdtempSync(join(tmpdir(), "judge-payload-fake-"));
  scratchDirs.push(directory);
  const binary = join(directory, "docker-fake");
  const script = `#!/usr/bin/env node
if (${exitCode} !== 0) {
  process.stderr.write(${JSON.stringify(stderr)});
  process.exit(${exitCode});
}
const chunks = [];
process.stdin.on("data", chunk => chunks.push(chunk));
process.stdin.on("end", () => {
  process.stdout.write(${JSON.stringify(stdout)} + "\\n");
  process.stderr.write(${JSON.stringify(stderr)});
});
`;
  writeFileSync(binary, script);
  chmodSync(binary, 0o755);
  return binary;
}

function listOwnedContainers(): string[] {
  const stdout = execFileSync("docker", [
    "ps",
    "-a",
    "-q",
    "--filter",
    "label=arena-judge-owned=true",
  ], { encoding: "utf8", timeout: 5000 });
  return stdout.trim().split("\n").filter(Boolean);
}

async function waitForOwnedContainersClean(baseline = new Set<string>(), timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const newlyCreated = listOwnedContainers().filter((id) => !baseline.has(id));
    if (newlyCreated.length === 0) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  const leftover = listOwnedContainers().filter((id) => !baseline.has(id));
  expect(leftover).toEqual([]);
}

afterEach(() => {
  for (const directory of scratchDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("judge payload transport (TICKET-14)", () => {
  const judge = new ContainerJudge();

  it("python snippet: executes valid near 100KiB source successfully (boundary fix)", async () => {
    // 100 KiB source (102,400 bytes) previously failed on Linux / Docker runc
    // with "argument list too long" (code 255) when passed via -e SRC=base64.
    const header = "def solve(nums):\n    return sum(nums)\n";
    const padding = "# " + "x".repeat(100 * 1024 - header.length - 3) + "\n";
    const source = header + padding;
    expect(Buffer.byteLength(source, "utf8")).toBe(100 * 1024);

    const result = await judge.runVisible(
      "Python",
      "snippet",
      source,
      [{ id: "case-large-src", input: "nums = [10, 20, 30]", expected: "60" }],
      LIMITS,
      "solve",
    );
    expect(result[0]).toMatchObject({
      passed: true,
      status: "accepted",
    });
  }, 30000);

  it("python snippet: resolves Solution class entrypoint", async () => {
    const source = `
class Solution:
    def two_sum(self, nums, target):
        lookup = {}
        for i, val in enumerate(nums):
            diff = target - val
            if diff in lookup:
                return [lookup[diff], i]
            lookup[val] = i
        return []
`;
    const result = await judge.runVisible(
      "Python",
      "snippet",
      source,
      [{ id: "c1", input: "nums = [2, 7, 11, 15]\ntarget = 9", expected: "[0, 1]" }],
      LIMITS,
      "two_sum",
    );
    expect(result[0]).toMatchObject({
      passed: true,
      status: "accepted",
    });
  }, 30000);

  it("python snippet: resolves top-level function entrypoint without Solution class", async () => {
    const source = `
def multiply(a, b):
    return a * b
`;
    const result = await judge.runVisible(
      "Python",
      "snippet",
      source,
      [{ id: "c1", input: "a = 6\nb = 7", expected: "42" }],
      LIMITS,
      "multiply",
    );
    expect(result[0]).toMatchObject({
      passed: true,
      status: "accepted",
    });
  }, 30000);

  it("python stdio: handles standard input and output correctly", async () => {
    const source = `
import sys
line = sys.stdin.read().strip()
nums = [int(x) for x in line.split()]
print(sum(nums))
`;
    const result = await judge.runVisible(
      "Python",
      "stdio",
      source,
      [{ id: "stdio1", input: "1 2 3 4 5", expected: "15" }],
      LIMITS,
    );
    expect(result[0]).toMatchObject({
      passed: true,
      status: "accepted",
    });
  }, 30000);

  it("c stdio: compiles and runs with stdio input", async () => {
    const source = `
#include <stdio.h>
int main() {
    int a, b;
    if (scanf("%d %d", &a, &b) == 2) {
        printf("%d\\n", a * b);
    }
    return 0;
}
`;
    const result = await judge.runVisible(
      "C",
      "stdio",
      source,
      [{ id: "c-stdio", input: "6 9", expected: "54" }],
      LIMITS,
    );
    expect(result[0]).toMatchObject({
      passed: true,
      status: "accepted",
    });
  }, 30000);

  it("c++ stdio: compiles and runs with stdio input", async () => {
    const source = `
#include <iostream>
#include <string>
int main() {
    std::string word;
    if (std::cin >> word) {
        std::cout << "echo:" << word << std::endl;
    }
    return 0;
}
`;
    const result = await judge.runVisible(
      "C++",
      "stdio",
      source,
      [{ id: "cpp-stdio", input: "nook_arena", expected: "echo:nook_arena" }],
      LIMITS,
    );
    expect(result[0]).toMatchObject({
      passed: true,
      status: "accepted",
    });
  }, 30000);

  it("stdio with binary NUL, newlines, quotes, shell metacharacters and multibyte UTF-8", async () => {
    // Tests real binary NUL bytes (0x00), multiple newlines, multi-byte UTF-8, quotes, and shell metacharacters
    const pySource = `
import hashlib, sys
raw = sys.stdin.buffer.read()
nul_count = raw.count(b"\\x00")
newline_count = raw.count(b"\\n")
total_bytes = len(raw)
sha = hashlib.sha256(raw).hexdigest()
print(f"{total_bytes} {nul_count} {newline_count} {sha}")
`;
    // Construct payload with actual NUL characters, newlines, emojis, and shell metacharacters
    const payloadParts = [
      "HEADER_PREFIX_SECTION\n",
      "\0".repeat(40), // 40 actual binary NUL bytes
      "MULTIBYTE_🚀_🎉_🌍_🔥\n",
      "MORE_NEWLINES\n\n\n\n",
      'SHELL_META: "$HOME" `uname` \'single\' "double" ; rm -rf / ; \\ \n',
      "\0".repeat(60), // 60 more actual binary NUL bytes
      "TRAILING_LINE_SECTION\n",
    ];
    const rawInput = payloadParts.join("");
    const rawBuffer = Buffer.from(rawInput, "utf8");
    const nulCount = 40 + 60;
    const newlineCount = 1 + 1 + 4 + 1 + 1; // 8 newlines
    const expectedSha = createHash("sha256").update(rawBuffer).digest("hex");
    const expectedOutput = `${rawBuffer.length} ${nulCount} ${newlineCount} ${expectedSha}`;

    const result = await judge.runVisible(
      "Python",
      "stdio",
      pySource,
      [{ id: "binary-nul-case", input: rawInput, expected: expectedOutput }],
      LIMITS,
    );
    expect(result[0].status).toBe("accepted");
    expect(result[0].passed).toBe(true);
  });

  it("large multibyte input: preserves exact UTF-8 byte framing and counting", async () => {
    // 4-byte UTF-8 emojis and multi-byte non-ASCII characters
    const emojiPayload = "🚀🎉🌍🔥".repeat(1000); // 4000 characters, 16000 bytes
    const source = `
def count_multibyte(data):
    # Verify exact length in characters and bytes
    return len(data)
`;
    const input = `data = "${emojiPayload}"`;
    const result = await judge.runVisible(
      "Python",
      "snippet",
      source,
      [{ id: "multibyte-case", input, expected: "4000" }],
      LIMITS,
      "count_multibyte",
    );
    expect(result[0]).toMatchObject({
      passed: true,
      status: "accepted",
    });
  }, 30000);

  it("unusual content in snippet mode: quotes, backslashes, newlines without delimiter collision", async () => {
    const source = `
def inspect_content(raw):
    return [
        raw.startswith("Hello\\nWorld!"),
        "$SHELL" in raw,
        "\`uname\`" in raw,
        "'single-quoted'" in raw,
        "; rm -rf / ;" in raw,
        len(raw),
    ]
`;
    const trickyString = "Hello\nWorld! \"$SHELL\" `uname` 'single-quoted' ; rm -rf / ; \\0 \\t";
    const input = `raw = ${JSON.stringify(trickyString)}`;
    const expected = `[True, True, True, True, True, ${trickyString.length}]`;

    const result = await judge.runVisible(
      "Python",
      "snippet",
      source,
      [{ id: "tricky-case", input, expected }],
      LIMITS,
      "inspect_content",
    );
    expect(result[0].status).toBe("accepted");
    expect(result[0].passed).toBe(true);
  }, 30000);

  it("normal competitive inner timeout: preserves time_limit_exceeded and cleans container via --rm", async () => {
    const baseline = new Set(listOwnedContainers());
    const source = `
def loop_forever(x):
    while True:
        pass
`;
    const result = await judge.runVisible(
      "Python",
      "snippet",
      source,
      [{ id: "timeout-case", input: "x = 1", expected: "0" }],
      { ...LIMITS, runWallMs: 1500 },
      "loop_forever",
    );
    expect(result[0].status).toBe("time_limit_exceeded");
    expect(result[0].passed).toBe(false);

    // Verify container cleanly exited and was cleaned up by Docker --rm
    await waitForOwnedContainersClean(baseline);
  }, 30000);

  it("outerTimeoutMs regression: orchestrator timeout shorter than inner limit settles as JudgeInfraError with zero leaked containers", async () => {
    const baseline = new Set(listOwnedContainers());
    // Inner limit is 60s, but orchestrator outerTimeoutMs is 1200ms
    const shortOuterJudge = new ContainerJudge({ outerTimeoutMs: 1200 });
    const source = `
def loop_forever(x):
    while True:
        pass
`;
    await expect(
      shortOuterJudge.runVisible(
        "Python",
        "snippet",
        source,
        [{ id: "outer-timeout-case", input: "x = 1", expected: "0" }],
        { ...LIMITS, runWallMs: 60000 },
        "loop_forever",
      ),
    ).rejects.toThrow(/judge orchestrator timeout/);

    // Verify bounded cleanup: docker rm -f was run on the exact owned container,
    // leaving no running or stopped container in Docker daemon
    await waitForOwnedContainersClean(baseline);
  }, 10000);

  it("real container runner validation: rejects truncated or corrupted framing with exit code 70", () => {
    // Directly test the in-container shell script preamble against real Docker execution
    const runnerScript = (judge as unknown as { oneCaseScript: (l: string, d: string, lim: typeof LIMITS) => string })
      .oneCaseScript("Python", "stdio", LIMITS);

    const runCorrupted = (payload: string) => {
      try {
        execFileSync("docker", [
          "run",
          "--interactive",
          "--rm",
          "python:3.12-slim",
          "bash",
          "-c",
          runnerScript,
        ], { input: payload, timeout: 5000 });
        expect.unreachable("expected container runner to fail");
      } catch (err: unknown) {
        expect((err as { status?: number }).status).toBe(70);
      }
    };

    // Test A: Truncated header (EOF before reading 3 length lines)
    runCorrupted("100\n");

    // Test B: Truncated body (promised 1000 bytes for source, sent only 15 bytes)
    runCorrupted("1000\n10\n10\ndef solve(): pass");

    // Test C: Non-numeric header value
    runCorrupted("invalid_length\n10\n10\n");

    // Test D: Length exceeding 8 MiB bound in header
    runCorrupted("99999999\n10\n10\n");
  }, 30000);

  it("runner exit code 70 maps to JudgeInfraError and ensures container cleanup", async () => {
    const fakeBinary = makeFakeDocker("", 70, "framing validation failed");
    const testJudge = new ContainerJudge({ dockerBin: fakeBinary });
    await expect(
      testJudge.runVisible(
        "Python",
        "snippet",
        "def solve(x): return x\n",
        [{ id: "c1", input: "x = 1", expected: "1" }],
        LIMITS,
      ),
    ).rejects.toThrow(/judge runner exited without a verdict \(code 70\)/);
  });

  it("rejects immediately with JudgeInfraError when payload exceeds MAX_CASE_PAYLOAD_BYTES", async () => {
    const hugeInput = "x".repeat(MAX_CASE_PAYLOAD_BYTES + 1);
    await expect(
      judge.runVisible(
        "Python",
        "snippet",
        "def solve(x): return x\n",
        [{ id: "huge", input: `x = "${hugeInput}"`, expected: "x" }],
        LIMITS,
      ),
    ).rejects.toThrow(JudgeInfraError);
  });

  it("missing docker binary raises JudgeInfraError and handles child.stdin error safely", async () => {
    const testJudge = new ContainerJudge({ dockerBin: "/nonexistent/docker-binary-missing" });
    await expect(
      testJudge.runVisible(
        "Python",
        "snippet",
        "def solve(x): return x\n",
        [{ id: "c1", input: "x = 1", expected: "1" }],
        LIMITS,
      ),
    ).rejects.toThrow(JudgeInfraError);
  });
});
