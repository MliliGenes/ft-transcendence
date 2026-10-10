import { describe, expect, it } from "vitest";
import { roundScore } from "../src/index.js";

describe("example package public interface", () => {
  it("calculates a rounded score from the number of passing cases", () => {
    expect(roundScore(2, 3)).toBe(67);
    expect(roundScore(0, 3)).toBe(0);
    expect(roundScore(3, 3)).toBe(100);
  });

  it("rejects invalid counts through the same interface", () => {
    expect(() => roundScore(1, 0)).toThrow(RangeError);
    expect(() => roundScore(4, 3)).toThrow(RangeError);
    expect(() => roundScore(-1, 3)).toThrow(RangeError);
  });
});
