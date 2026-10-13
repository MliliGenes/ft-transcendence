import { afterEach, describe, expect, it, vi } from "vitest";
import { createRuntimeCloser } from "./runtime-close.js";
afterEach(() => vi.useRealTimers());
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
describe("bounded runtime close", () => {
  it("stops ingress immediately, shares close, and upgrades a normal stop to loss", async () => {
    vi.useFakeTimers(); const gate = deferred(); const trace: string[] = [];
    const exit = vi.fn();
    const close = createRuntimeCloser({
      stop: () => { trace.push("stop"); return gate.promise; },
      stopHttpAcceptance: () => { trace.push("http"); },
      disconnectSockets: () => { trace.push("sockets"); },
      closeApplication: async () => { trace.push("app"); }, exit, report: vi.fn(),
    });
    const normal = close(); expect(trace).toEqual(["stop", "http", "sockets"]);
    expect(close(new Error("owner ended"))).toBe(normal);
    gate.resolve(); await normal;
    expect(trace).toEqual(["stop", "http", "sockets", "app"]);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });
  it("exits at 5000ms even if Nest and a store never resolve", async () => {
    vi.useFakeTimers(); const gate = deferred(); const exit = vi.fn();
    const close = createRuntimeCloser({ stop: () => gate.promise,
      stopHttpAcceptance: vi.fn(), disconnectSockets: vi.fn(),
      closeApplication: () => gate.promise, exit, report: vi.fn() });
    void close(new Error("owner ended"));
    await vi.advanceTimersByTimeAsync(4999); expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    // Real exit terminates the process; complete the fake promises for test cleanup.
    gate.resolve();
  });
  it("shares the close promise when a stop hook re-enters close", async () => {
    const exit = vi.fn(); let repeated: Promise<void> | undefined;
    let close!: (error?: Error) => Promise<void>;
    const stop = vi.fn(() => { repeated = close(new Error("owner ended")); return Promise.resolve(); });
    close = createRuntimeCloser({ stop, stopHttpAcceptance: vi.fn(), disconnectSockets: vi.fn(),
      closeApplication: async () => {}, exit, report: vi.fn() });
    const first = close(); expect(repeated).toBe(first); await first;
    expect(stop).toHaveBeenCalledTimes(1); expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });
  it("reports a failed close and exits nonzero", async () => {
    const report = vi.fn(); const exit = vi.fn();
    const close = createRuntimeCloser({ stop: async () => { throw new Error("close failed"); },
      stopHttpAcceptance: vi.fn(), disconnectSockets: vi.fn(),
      closeApplication: async () => {}, exit, report });
    await close(); expect(report).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });
});
