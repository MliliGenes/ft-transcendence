import { describe, expect, it } from "vitest";
import { DraftRepository, draftKey, type DraftScope, type DraftStorage } from "./draft.js";

class FakeStorage implements DraftStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  keys(): string[] {
    return [...this.values.keys()];
  }
}

const alice: DraftScope = { playerId: "alice", scopeKey: "live:http://arena.test:match-1" };
const bob: DraftScope = { playerId: "bob", scopeKey: "live:http://arena.test:match-1" };

describe("identity-scoped editor drafts", () => {
  it("keys include the player id and match scope", () => {
    expect(draftKey(alice, 2, "even-ledger", "Python")).toContain(":alice:");
    expect(draftKey(alice, 2, "even-ledger", "Python")).toContain(alice.scopeKey);
    expect(draftKey(alice, 2, "even-ledger", "Python")).not.toBe(draftKey(bob, 2, "even-ledger", "Python"));
  });

  it("never returns one player's draft to another account on the same browser", () => {
    const repository = new DraftRepository(new FakeStorage());
    repository.save(alice, 1, "even-ledger", "Python", "print('alice')");

    expect(repository.load(alice, 1, "even-ledger", "Python")).toBe("print('alice')");
    expect(repository.load(bob, 1, "even-ledger", "Python")).toBeNull();
  });

  it("ignores legacy player-less keys instead of adopting them", () => {
    const storage = new FakeStorage();
    storage.setItem(`arena-draft:${alice.scopeKey}:1:even-ledger:Python`, "legacy code");
    const repository = new DraftRepository(storage);

    expect(repository.load(alice, 1, "even-ledger", "Python")).toBeNull();
  });

  it("keeps a session-memory copy when storage is blocked", () => {
    const blocked: DraftStorage = {
      getItem: () => {
        throw new Error("storage blocked");
      },
      setItem: () => {
        throw new Error("storage blocked");
      },
      removeItem: () => {
        throw new Error("storage blocked");
      },
      keys: () => {
        throw new Error("storage blocked");
      },
    };
    const repository = new DraftRepository(blocked);

    expect(() => repository.save(alice, 1, "even-ledger", "Python", "offline draft")).not.toThrow();
    expect(repository.load(alice, 1, "even-ledger", "Python")).toBe("offline draft");
  });

  it("prunes older-round keys for the same player/scope on write", () => {
    const storage = new FakeStorage();
    const repository = new DraftRepository(storage);
    repository.save(alice, 1, "even-ledger", "Python", "round 1 python");
    repository.save(alice, 1, "even-ledger", "C++", "round 1 cpp");
    repository.save(bob, 1, "even-ledger", "Python", "bob round 1");
    repository.save({ ...alice, scopeKey: "live:http://arena.test:match-2" }, 1, "even-ledger", "Python", "other match");

    repository.save(alice, 2, "even-ledger", "Python", "round 2");

    expect(repository.load(alice, 1, "even-ledger", "Python")).toBeNull();
    expect(repository.load(alice, 1, "even-ledger", "C++")).toBeNull();
    expect(repository.load(bob, 1, "even-ledger", "Python")).toBe("bob round 1");
    expect(repository.load({ ...alice, scopeKey: "live:http://arena.test:match-2" }, 1, "even-ledger", "Python")).toBe("other match");
    expect(repository.load(alice, 2, "even-ledger", "Python")).toBe("round 2");
    expect(
      [...storage.keys()].filter((key) => key.startsWith(`arena-draft:v2:alice:${alice.scopeKey}:`) && key.includes(":1:")),
    ).toEqual([]);
  });

  it("preserves the newer round's saved draft when a stale tab writes an older round", () => {
    const storage = new FakeStorage();
    const currentTab = new DraftRepository(storage);
    const staleTab = new DraftRepository(storage);
    currentTab.save(alice, 2, "round-two-problem", "Python", "newer round draft");

    staleTab.save(alice, 1, "even-ledger", "Python", "older tab draft");

    const reloadedTab = new DraftRepository(storage);
    expect(reloadedTab.load(alice, 2, "round-two-problem", "Python")).toBe("newer round draft");
  });
});
