import { describe, expect, it } from "vitest";
import { remainingMsFromSample, remainingSecondsFromSample } from "./clock.js";
import { MockArenaTransport } from "./mock.js";

describe("server-anchored Match clock", () => {
  it("derives remaining time from the server sample plus monotonic elapsed time", () => {
    expect(remainingMsFromSample({ remainingMs: 30_000, sampledAt: 1_000 }, 6_000)).toBe(25_000);
  });

  it("never extends the clock when the client clock moves backwards", () => {
    expect(remainingMsFromSample({ remainingMs: 30_000, sampledAt: 10_000 }, 4_000)).toBe(30_000);
  });

  it("clamps at zero", () => {
    expect(remainingMsFromSample({ remainingMs: 1_000, sampledAt: 0 }, 5_000)).toBe(0);
    expect(remainingSecondsFromSample({ remainingMs: 1_000, sampledAt: 0 }, 5_000)).toBe(0);
  });

  it("rounds display seconds up so the final second stays visible", () => {
    expect(remainingSecondsFromSample({ remainingMs: 999, sampledAt: 0 }, 0)).toBe(1);
    expect(remainingSecondsFromSample({ remainingMs: 1_001, sampledAt: 0 }, 0)).toBe(2);
  });

  it("the mock supplies an exact sample alongside its coarse display seconds", () => {
    const snapshot = new MockArenaTransport("1v1").snapshot();
    expect(snapshot.clock).toBeDefined();
    expect(snapshot.clock!.remainingMs).toBeGreaterThanOrEqual(0);
    expect(snapshot.clock!.remainingMs).toBeLessThanOrEqual(30 * 60 * 1000);
    expect(snapshot.remainingSeconds).toBe(Math.ceil(snapshot.clock!.remainingMs / 1000));
    expect(snapshot.clock!.sampledAt).toEqual(expect.any(Number));
  });
});
