import { describe, expect, it } from "vitest";
import { selectLobbyProblems } from "./game.service.js";

describe("Code Arena lobby problem selection", () => {
  it("uses three distinct seeded problems for a three-round match", () => {
    const problems = selectLobbyProblems();
    expect(problems).toHaveLength(3);
    expect(new Set(problems)).toEqual(new Set(["even-ledger-v2", "double-it", "sum-array"]));
  });
});
