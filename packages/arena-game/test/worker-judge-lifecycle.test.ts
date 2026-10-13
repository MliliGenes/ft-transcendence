import { describe, expect, it } from "vitest";
import { WorkerJudgeAdapter } from "../src/judge.js";
const limits = { compileWallMs: 1000, runWallMs: 1000, runMemoryMb: 64,
  runOutputBytes: 1024, runCpus: 1, runPids: 16 };
function heldFetch() {
  let entered!: () => void;
  const started = new Promise<void>((done) => { entered = done; });
  const fetchImpl: typeof fetch = async (_input, init) => {
    const signal = init!.signal!; entered();
    return new Promise<Response>((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  };
  return { fetchImpl, started };
}
describe("Worker lifecycle cancellation", () => {
  it.each(["visible", "sealed"] as const)("aborts a held %s request", async (kind) => {
    const life = new AbortController(); const fetch = heldFetch();
    const judge = new WorkerJudgeAdapter({ baseUrl: "http://worker.internal", token: "test",
      signal: life.signal, timeoutMs: 100, fetchImpl: fetch.fetchImpl });
    const request = kind === "visible"
      ? judge.runVisible("Python", "snippet", "pass", [], limits)
      : judge.evaluateSealed({ evaluationId: "e", submissionId: "s", problemVersionId: "p",
          hiddenSuiteId: "h", language: "Python", driver: "snippet", source: "pass", groups: [], limits });
    const rejected = expect(request).rejects.toThrow(/stopped/);
    await fetch.started; life.abort(new Error("shutdown")); await rejected;
  });
  it("aborts reading a body after headers", async () => {
    const life = new AbortController(); let entered!: () => void;
    const bodyStarted = new Promise<void>((done) => { entered = done; });
    const fetchImpl: typeof fetch = async (_input, init) => {
      const signal = init!.signal!;
      let sent = false;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
        },
        pull(controller) {
          if (sent) return;
          sent = true; controller.enqueue(new TextEncoder().encode("[")); entered();
        },
      }, { highWaterMark: 0 });
      return new Response(body, { headers: { "content-type": "application/json" } });
    };
    const judge = new WorkerJudgeAdapter({ baseUrl: "http://worker.internal", token: "test",
      signal: life.signal, timeoutMs: 100, fetchImpl });
    const request = judge.runVisible("Python", "snippet", "pass", [], limits);
    const rejected = expect(request).rejects.toThrow(/stopped/);
    await bodyStarted; life.abort(new Error("shutdown")); await rejected;
  });
  it("keeps the timeout when a lifecycle signal is present", async () => {
    const fetch = heldFetch(); const life = new AbortController();
    const judge = new WorkerJudgeAdapter({ baseUrl: "http://worker.internal", token: "test",
      signal: life.signal, timeoutMs: 5, fetchImpl: fetch.fetchImpl });
    const request = judge.runVisible("Python", "snippet", "pass", [], limits);
    const rejected = expect(request).rejects.toThrow(/timed out/);
    await new Promise((resolve) => setTimeout(resolve, 15)); await rejected;
  });
});
