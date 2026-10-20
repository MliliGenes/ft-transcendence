import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { ContainerJudge, FileBank, SPIKE_LIMITS, WorkerJudgeAdapter } from "arena-game-engine/judge";
import { createJudgeWorkerServer } from "../src/http-server.js";
import { BoundedJobQueue } from "../src/job-queue.js";

const servers: Server[] = [];
const TOKEN = "starter-execution-test-token";

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function worker(): Promise<WorkerJudgeAdapter> {
  const server = createJudgeWorkerServer({
    token: TOKEN,
    judge: new ContainerJudge(),
    queue: new BoundedJobQueue({ concurrency: 1, maxQueueSize: 1, queueTimeoutMs: 1000, executionTimeoutMs: 30000 }),
    readiness: { check: async () => ({ ready: true, docker: true, images: { python: true, gcc: true } }) },
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("worker did not bind a port");
  return new WorkerJudgeAdapter({ baseUrl: `http://127.0.0.1:${address.port}`, token: TOKEN });
}

describe("real starter execution through the Judge HTTP worker", () => {
  it("keeps the bank entrypoint when Python Solution also has a helper", async () => {
    const judge = await worker();
    const bank = new FileBank().loadProblem("even-ledger");
    const source = `class Solution:
    def helper(self):
        return 123
    def ledger_sum(self, nums):
        return sum(value if index % 2 == 0 else -value for index, value in enumerate(nums))
`;
    const result = await judge.runVisible("Python", "snippet", source, bank.visible, SPIKE_LIMITS, { entrypoint: bank.entrypoint });
    expect(result.map((test) => test.status)).toEqual(["accepted", "accepted", "accepted"]);
    expect(result.map((test) => test.passed)).toEqual([true, true, true]);
  }, 30000);
  it("executes C++ bank starters and sealed solutions with their declared ABI", async () => {
    const judge = await worker();
    const bank = new FileBank().loadProblem("even-ledger");
    const options = bank.snippets?.["C++"];
    const starter = bank.starters["C++"]!;
    const run = await judge.runVisible("C++", "snippet", starter, bank.visible, SPIKE_LIMITS, options);
    expect(run.map((test) => test.status)).toEqual(["accepted", "accepted", "accepted"]);
    expect(run.map((test) => test.passed)).toEqual([false, false, true]);
    const source = starter.replace("return 0;", "long long result = 0; for (unsigned int i = 0; i < nums.size(); ++i) result += i % 2 == 0 ? nums[i] : -nums[i]; return result;");
    const sealed = await judge.evaluateSealed({
      evaluationId: "evaluation", submissionId: "submission", problemVersionId: bank.problemVersionId,
      hiddenSuiteId: bank.hiddenSuiteId, language: "C++", driver: "snippet", source,
      groups: bank.hidden, limits: SPIKE_LIMITS, ...options,
    });
    expect(sealed.groups.flatMap((group) => group.results).every((test) => test.passed)).toBe(true);
    expect(JSON.stringify(sealed)).not.toContain('"expected"');
    expect(JSON.stringify(sealed)).not.toContain('"input"');
  }, 30000);

  it.each(["C", "C++", "Python"] as const)("%s executes a valid 100000-element case over HTTP without truncation", async (language) => {
    const judge = await worker();
    const bank = new FileBank().loadProblem("even-ledger");
    const solution = language === "Python"
      ? "return sum(value if index % 2 == 0 else -value for index, value in enumerate(nums))"
      : language === "C"
        ? "long long total = 0; for (int i = 0; i < n; ++i) total += i % 2 == 0 ? nums[i] : -nums[i]; return total;"
        : "long long total = 0; for (unsigned int i = 0; i < nums.size(); ++i) total += i % 2 == 0 ? nums[i] : -nums[i]; return total;";
    const source = bank.starters[language]!.replace("return 0;", solution).replace("return 0", solution);
    const input = "nums = [" + Array.from({ length: 100000 }, (_, index) => index % 2 === 0 ? "1000000000" : "-1000000000").join(",") + "]";
    // Fifty thousand alternating pairs contribute 2000000000 each.
    const test = { id: "maximum-case", input, expected: "100000000000000" };
    const options = { entrypoint: bank.entrypoint, ...bank.snippets?.[language] };
    const run = await judge.runVisible(language, "snippet", source, [test], SPIKE_LIMITS, options);
    expect(run).toEqual([expect.objectContaining({
      id: test.id, status: "accepted", passed: true,
      output: language === "Python" ? "100000000000000" : "100000000000000\n",
    })]);
    const sealed = await judge.evaluateSealed({
      evaluationId: "maximum-evaluation", submissionId: "maximum-submission", problemVersionId: bank.problemVersionId,
      hiddenSuiteId: bank.hiddenSuiteId, language, driver: "snippet", source, ...options,
      groups: [{ name: "maximum-array", weight: 100, tests: [test] }], limits: SPIKE_LIMITS,
    });
    expect(sealed.groups[0]?.results).toEqual([expect.objectContaining({ id: test.id, status: "accepted", passed: true })]);
    expect(JSON.stringify(sealed)).not.toContain('"input"');
    expect(JSON.stringify(sealed)).not.toContain('"expected"');
  }, 30000);

  it("rejects malformed compiled metadata at the authenticated HTTP seam", async () => {
    const judge = await worker();
    for (const options of [
      { entrypoint: "ledgerSum();", signature: "int64-array" as const },
      { entrypoint: "ledgerSum", className: "Solution;bad", signature: "int64-array" as const },
    ]) {
      await expect(judge.runVisible("C++", "snippet", "", [], SPIKE_LIMITS, options)).rejects.toThrow("HTTP 400");
    }
  });

});
