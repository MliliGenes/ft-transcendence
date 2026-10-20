import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ContainerJudge, Judge0Adapter, type GameJudge } from "../src/judge.js";
import { ArenaEngine } from "../src/index.js";
import { FileBank } from "../src/judge.js";
import { SPIKE_LIMITS } from "../src/judge.js";
import { testPrincipal } from "../src/index.js";

const LIMITS = { ...SPIKE_LIMITS, runWallMs: 8000, compileWallMs: 60000 };

const C_SOLVE = [
  "#include <stdio.h>",
  "int main(void){long long x; if(scanf(\"%lld\",&x)!=1) return 1; printf(\"%lld\\n\", x*2); return 0;}",
  "",
].join("\n");

const CPP_SOLVE = [
  "#include <cstdio>",
  "int main(){long long x; if(!(std::scanf(\"%lld\",&x))) return 1; std::printf(\"%lld\\n\", x*2); return 0;}",
  "",
].join("\n");

const PY_SOLVE = `def ledger_sum(nums):
    total = 0
    for i, v in enumerate(nums):
        total += v if i % 2 == 0 else -v
    return total
`;

async function realEngine(problemVersionIds: string[], judge: GameJudge = new ContainerJudge(), limits = LIMITS, bank = new FileBank()): Promise<{ engine: ArenaEngine; matchId: string }> {
  const engine = new ArenaEngine({
    judge,
    bank,
    clock: () => 1_000_000,
    revealGraceMs: 0,
    limits,
  });
  const left = testPrincipal("user-left");
  const matchId = await engine.createMatch({
    mode: "1v1",
    participants: [
      { userId: "user-left", sideId: "left" },
      { userId: "user-right", sideId: "right" },
    ],
    problemVersionIds,
  });
  await engine.startRound(left, matchId);
  await engine.beginCoding(left, matchId);
  return { engine, matchId };
}

function localJudge0(): Judge0Adapter {
  const executor = new ContainerJudge();
  let response: { status: { id: number }; stdout: string; stderr: string; time: string };
  // Local provider fixture executes the actual provider program in an isolated container.
  return new Judge0Adapter({ http: {
    createSubmission: async (request) => {
      const language = request.languageId === 50 ? "C" : request.languageId === 54 ? "C++" : "Python";
      const [result] = await executor.runVisible(language, "stdio", request.sourceCode,
        [{ id: "provider-case", input: request.stdin, expected: "" }], LIMITS);
      response = { status: { id: result!.status === "accepted" ? 3 : 11 }, stdout: result!.output, stderr: "", time: "0.01" };
      return { token: "local-provider-fixture" };
    },
    getSubmission: async () => response,
  } });
}

const bankDirectories: string[] = [];
afterEach(() => { for (const directory of bankDirectories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function caseBank(problemId: string, input: string, expected: string): { bank: FileBank; path: string } {
  const directory = mkdtempSync(join(tmpdir(), "arena-case-bank-"));
  bankDirectories.push(directory);
  const record = JSON.parse(readFileSync(new URL(`../../problem-bank/problems/${problemId}.json`, import.meta.url), "utf8"));
  record.visibleTests = [{ id: "fixture-visible", input, expected }];
  record.hiddenGroups = [{ name: "fixture-group", weight: 100, tests: [{ id: "fixture-hidden", input, expected }] }];
  const path = join(directory, `${problemId}.json`);
  writeFileSync(path, JSON.stringify(record));
  return { bank: new FileBank(directory), path };
}

function maximumArrayBank(): FileBank {
  const input = "nums = [" + Array.from({ length: 100000 }, (_, index) => index % 2 === 0 ? "1000000000" : "-1000000000").join(",") + "]";
  // Each alternating pair contributes 2000000000. Fifty thousand pairs total 100000000000000.
  return caseBank("even-ledger", input, "100000000000000").bank;
}

describe("real bank execution (snippets and stdio, isolated containers)", () => {
  it.each(["C", "C++", "Python"] as const)("%s Run and Submit execute a valid 100000-element bank case", async (language) => {
    const bank = maximumArrayBank();
    const { engine, matchId } = await realEngine(["even-ledger"], new ContainerJudge(), LIMITS, bank);
    const solution = language === "Python"
      ? "return sum(value if index % 2 == 0 else -value for index, value in enumerate(nums))"
      : language === "C"
        ? "long long total = 0; for (int i = 0; i < n; ++i) total += i % 2 == 0 ? nums[i] : -nums[i]; return total;"
        : "long long total = 0; for (unsigned int i = 0; i < nums.size(); ++i) total += i % 2 == 0 ? nums[i] : -nums[i]; return total;";
    const source = bank.loadProblem("even-ledger").starters[language]!.replace("return 0;", solution).replace("return 0", solution);
    const left = testPrincipal("user-left");
    const result = await engine.run(left, matchId, { language, code: source });
    expect(result.tests).toEqual([expect.objectContaining({ id: "fixture-visible", passed: true, output: language === "Python" ? "100000000000000" : "100000000000000\n" })]);
    await engine.submit(left, matchId, { language, code: source });
    expect((await engine.publishReveal(left, matchId)).scores.left).toBe(100);
  }, 30000);

  it("Run and Submit preserve multibyte source and stdio input", async () => {
    const { bank } = caseBank("double-it", "Salam 🧪 café\n", "Salam 🧪 café");
    const { engine, matchId } = await realEngine(["double-it"], new ContainerJudge(), LIMITS, bank);
    const source = "# اختبار 🧪\nprint(input())\n";
    const left = testPrincipal("user-left");
    const result = await engine.run(left, matchId, { language: "Python", code: source });
    expect(result.tests).toEqual([expect.objectContaining({ passed: true, output: "Salam 🧪 café\n" })]);
    await engine.submit(left, matchId, { language: "Python", code: source });
    expect((await engine.publishReveal(left, matchId)).scores.left).toBe(100);
  }, 30000);

  it("an oversized bank case fails as infrastructure without a submission or a stuck Run", async () => {
    const { bank, path } = caseBank("double-it", "x".repeat(8 * 1024 * 1024), "0");
    const { engine, matchId } = await realEngine(["double-it"], new ContainerJudge(), LIMITS, bank);
    const left = testPrincipal("user-left");
    const input = { language: "Python", code: "print(0)" };
    await expect(engine.run(left, matchId, input)).rejects.toThrow("transport limit");
    await expect(engine.submit(left, matchId, input)).rejects.toThrow("transport limit");
    expect((await engine.snapshot(left, matchId)).sides.left?.submissions).toBe(0);
    // Correcting the owned fixture should let the same Match continue normally.
    const record = JSON.parse(readFileSync(path, "utf8"));
    record.visibleTests[0].input = "0";
    record.hiddenGroups[0].tests[0].input = "0";
    writeFileSync(path, JSON.stringify(record));
    expect((await engine.run(left, matchId, input)).tests[0]?.passed).toBe(true);
    await engine.submit(left, matchId, input);
    expect((await engine.publishReveal(left, matchId)).scores.left).toBe(100);
  }, 30000);

  it.each(["container", "judge0"] as const)("%s selects the declared free function with an unrelated Solution class", async (provider) => {
    const { engine, matchId } = await realEngine(["even-ledger"], provider === "container" ? new ContainerJudge() : localJudge0());
    const left = testPrincipal("user-left");
    const source = PY_SOLVE + "\nclass Solution:\n    pass\n";
    const run = await engine.run(left, matchId, { code: source, language: "Python" });
    expect(run.tests.map((test) => test.passed)).toEqual([true, true, true]);
    await engine.submit(left, matchId, { code: source, language: "Python" });
    expect((await engine.publishReveal(left, matchId)).scores.left).toBe(100);
  }, 30000);

  it.each(["Python", "C++"] as const)("%s Run and Submit preserve snippet metadata through the optional Judge0 protocol", async (language) => {
    const judge = localJudge0();
    const { engine, matchId } = await realEngine(["even-ledger"], judge);
    const source = language === "Python" ? `class Solution:
    def helper(self):
        return 123
    def ledger_sum(self, nums):
        return sum(value if index % 2 == 0 else -value for index, value in enumerate(nums))
` : new FileBank().loadProblem("even-ledger").starters["C++"]!.replace("return 0;", "long long result = 0; for (unsigned int i = 0; i < nums.size(); ++i) result += i % 2 == 0 ? nums[i] : -nums[i]; return result;");
    const left = testPrincipal("user-left");
    const run = await engine.run(left, matchId, { code: source, language });
    expect(run.tests.map((test) => test.passed)).toEqual([true, true, true]);
    await engine.submit(left, matchId, { code: source, language });
    expect((await engine.publishReveal(left, matchId)).scores.left).toBe(100);
  }, 30000);


  it("Python editor starter runs the bank examples without an entry error", async () => {
    const { engine, matchId } = await realEngine(["even-ledger"]);
    const starter = new FileBank().loadProblem("even-ledger").starters.Python!;
    const result = await engine.run(testPrincipal("user-left"), matchId, {
      code: starter, language: "Python",
    });
    expect(result.tests.map((test) => test.passed)).toEqual([false, false, true]);
    expect(result.tests.map((test) => test.output.trim())).toEqual(["0", "0", "0"]);
  }, 30000);

  it("Python Run selects the bank entrypoint when Solution has a helper method", async () => {
    const { engine, matchId } = await realEngine(["even-ledger"]);
    const source = `class Solution:
    def helper(self):
        return 123
    def ledger_sum(self, nums):
        return sum(value if index % 2 == 0 else -value for index, value in enumerate(nums))
`;
    const result = await engine.run(testPrincipal("user-left"), matchId, { code: source, language: "Python" });
    expect(result.tests.map((test) => test.passed)).toEqual([true, true, true]);
  }, 30000);

  it("a nonterminating Solution constructor is bounded and leaves Run usable", async () => {
    const { engine, matchId } = await realEngine(["even-ledger"], new ContainerJudge(), { ...LIMITS, runWallMs: 1000 });
    const left = testPrincipal("user-left");
    const source = `class Solution:
    def __init__(self):
        while True:
            pass
    def ledger_sum(self, nums):
        return 0
`;
    const timedOut = await engine.run(left, matchId, { code: source, language: "Python" });
    expect(timedOut.tests.map((test) => test.passed)).toEqual([false, false, false]);
    const next = await engine.run(left, matchId, { code: PY_SOLVE, language: "Python" });
    expect(next.tests.map((test) => test.passed)).toEqual([true, true, true]);
  }, 15000);

  it("C editor snippet starter runs the bank examples", async () => {
    const { engine, matchId } = await realEngine(["even-ledger"]);
    const starter = new FileBank().loadProblem("even-ledger").starters.C!;
    const result = await engine.run(testPrincipal("user-left"), matchId, { code: starter, language: "C" });
    expect(result.tests.map((test) => test.passed)).toEqual([false, false, true]);
    expect(result.tests.map((test) => test.output.trim())).toEqual(["0", "0", "0"]);
  }, 30000);

  it("C bank snippet solution runs and scores 100 on Submit", async () => {
    const { engine, matchId } = await realEngine(["even-ledger"]);
    const source = `long long ledgerSum(long long *nums, int n) {
  long long total = 0;
  for (int i = 0; i < n; ++i) total += i % 2 == 0 ? nums[i] : -nums[i];
  return total;
}`;
    const left = testPrincipal("user-left");
    const run = await engine.run(left, matchId, { code: source, language: "C" });
    expect(run.tests.map((test) => test.passed)).toEqual([true, true, true]);
    await engine.submit(left, matchId, { code: source, language: "C" });
    expect((await engine.publishReveal(left, matchId)).scores.left).toBe(100);
  }, 120000);

  it("C++ bank snippet starter runs and its completed Solution scores 100", async () => {
    const { engine, matchId } = await realEngine(["even-ledger"]);
    const left = testPrincipal("user-left");
    const starter = new FileBank().loadProblem("even-ledger").starters["C++"]!;
    const initial = await engine.run(left, matchId, { code: starter, language: "C++" });
    expect(initial.tests.map((test) => test.passed)).toEqual([false, false, true]);
    expect(initial.tests.map((test) => test.output.trim())).toEqual(["0", "0", "0"]);
    const source = `#include <vector>
class Solution {
public:
  long long ledgerSum(const std::vector<long long>& nums) {
    long long total = 0;
    for (unsigned int i = 0; i < nums.size(); ++i) total += i % 2 == 0 ? nums[i] : -nums[i];
    return total;
  }
};`;
    const run = await engine.run(left, matchId, { code: source, language: "C++" });
    expect(run.tests.map((test) => test.passed)).toEqual([true, true, true]);
    await engine.submit(left, matchId, { code: source, language: "C++" });
    expect((await engine.publishReveal(left, matchId)).scores.left).toBe(100);
  }, 120000);

  it("C solution scores 100 end-to-end", async () => {
    const { engine, matchId } = await realEngine(["double-it"]);
    const left = testPrincipal("user-left");
    await engine.submit(left, matchId, { code: C_SOLVE, language: "C" });
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(100);
  }, 120000);

  it("C++ solution scores 100 end-to-end", async () => {
    const { engine, matchId } = await realEngine(["double-it"]);
    const left = testPrincipal("user-left");
    await engine.submit(left, matchId, { code: CPP_SOLVE, language: "C++" });
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(100);
  }, 120000);

  it("C starter scores 25, not 100 (only the zero case passes its 50-weight group half)", async () => {
    const { engine, matchId } = await realEngine(["double-it"]);
    const left = testPrincipal("user-left");
    const starter = new FileBank().loadProblem("double-it").starters.C!;
    await engine.submit(left, matchId, { code: starter, language: "C" });
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(25);
  }, 120000);

  it("Python bank solution scores 100 via snippet entrypoint", async () => {
    const { engine, matchId } = await realEngine(["even-ledger"]);
    const left = testPrincipal("user-left");
    await engine.submit(left, matchId, { code: PY_SOLVE, language: "Python" });
    const reveal = await engine.publishReveal(left, matchId);
    expect(reveal.scores.left).toBe(100);
  }, 120000);
});
