import { describe, expect, it } from "vitest";
import { prepareCompiledSnippet } from "../src/lib/compiled-snippet.js";
import { JudgeInfraError } from "../src/lib/judge-types.js";

describe("prepareCompiledSnippet", () => {
  it("prepares valid C snippet harness and stdin", () => {
    const result = prepareCompiledSnippet(
      "C",
      "long long solve(long long* arr, int n) { return 42; }",
      "nums = [1, 2, 3]",
      { signature: "int64-array", entrypoint: "solve" },
    );
    expect(result.source).toContain("#include <stdio.h>");
    expect(result.source).toContain("solve(values, n)");
    expect(result.input).toBe("3\n1 2 3\n");
  });

  it("prepares valid C++ snippet harness and stdin", () => {
    const result = prepareCompiledSnippet(
      "C++",
      "class Solution { public: long long solve(std::vector<long long>& v) { return 42; } };",
      "nums = [10, -20, 30]",
      { signature: "int64-array", entrypoint: "solve", className: "Solution" },
    );
    expect(result.source).toContain("#include <iostream>");
    expect(result.source).toContain("Solution().solve(values)");
    expect(result.input).toBe("3\n10 -20 30\n");
  });

  it("handles empty array correctly", () => {
    const result = prepareCompiledSnippet(
      "C",
      "long long solve(long long* arr, int n) { return 0; }",
      "nums = []",
      { signature: "int64-array", entrypoint: "solve" },
    );
    expect(result.input).toBe("0\n\n");
  });

  it("rejects non-compiled languages", () => {
    expect(() =>
      prepareCompiledSnippet(
        "Python" as any,
        "code",
        "nums = [1]",
        { signature: "int64-array", entrypoint: "solve" },
      ),
    ).toThrow(JudgeInfraError);
  });

  it("rejects missing or invalid signature/entrypoint", () => {
    expect(() =>
      prepareCompiledSnippet("C", "code", "nums = [1]", { signature: "unknown" as any, entrypoint: "solve" }),
    ).toThrow(JudgeInfraError);

    expect(() =>
      prepareCompiledSnippet("C", "code", "nums = [1]", { signature: "int64-array", entrypoint: "123bad" }),
    ).toThrow(JudgeInfraError);
  });

  it("rejects C++ snippet with missing or invalid className", () => {
    expect(() =>
      prepareCompiledSnippet("C++", "code", "nums = [1]", { signature: "int64-array", entrypoint: "solve" }),
    ).toThrow(JudgeInfraError);

    expect(() =>
      prepareCompiledSnippet("C++", "code", "nums = [1]", {
        signature: "int64-array",
        entrypoint: "solve",
        className: "bad-name!",
      }),
    ).toThrow(JudgeInfraError);
  });

  it("rejects malformed array input", () => {
    expect(() =>
      prepareCompiledSnippet("C", "code", "not an assignment", { signature: "int64-array", entrypoint: "solve" }),
    ).toThrow(JudgeInfraError);
  });

  it("rejects input exceeding int64 bounds", () => {
    expect(() =>
      prepareCompiledSnippet("C", "code", "nums = [99999999999999999999999999999999]", {
        signature: "int64-array",
        entrypoint: "solve",
      }),
    ).toThrow(JudgeInfraError);
  });
});
