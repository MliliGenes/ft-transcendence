import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { ArenaEngine, testPrincipal } from "../src/index.js";
import { FileBank } from "../src/judge.js";
import { inMemoryPersistence, PostgresStores, MatchRevisionConflictError, type MatchPersistence } from "../src/persistence.js";
import { ScriptedJudge } from "./scripted-judge.js";
import { SOLVED_PY } from "./setup.js";

const pgUrl = process.env.TEST_PG_URL;
const a = testPrincipal("cache-a");
const mate = testPrincipal("cache-mate");

function edit(sync: { roundId: string; stateB64: string }, source: string, replace = false) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(Buffer.from(sync.stateB64, "base64")));
  const vector = Y.encodeStateVector(doc);
  const text = doc.getText("source");
  doc.transact(() => {
    if (replace) text.delete(0, text.length);
    text.insert(text.length, source);
  });
  const updateB64 = Buffer.from(Y.encodeStateAsUpdate(doc, vector)).toString("base64");
  doc.destroy();
  return { roundId: sync.roundId, updateB64 };
}

for (const adapter of ["memory", "postgres"] as const) {
  describe.skipIf(adapter === "postgres" && !pgUrl)(`shared document cache (${adapter})`, () => {
    let firstStore: PostgresStores | undefined;
    let secondStore: PostgresStores | undefined;
    let persistence: MatchPersistence;
    let otherPersistence: MatchPersistence;
    beforeAll(async () => {
      if (adapter === "postgres") {
        firstStore = new PostgresStores(pgUrl!, { runtimeOwnership: "fixture" });
        secondStore = new PostgresStores(pgUrl!, { runtimeOwnership: "fixture" });
        await firstStore.ensureSchema();
        await secondStore.ensureSchema();
      }
    });
    beforeEach(() => {
      persistence = firstStore?.persistence ?? inMemoryPersistence();
      otherPersistence = secondStore?.persistence ?? persistence;
    });
    afterAll(async () => { await Promise.all([firstStore?.close(), secondStore?.close()]); });

    async function fixture() {
      const judge = new ScriptedJudge([{ score: 100 }]);
      const bank = new FileBank();
      const first = new ArenaEngine({ persistence, bank, judge, clock: () => 1000 });
      const second = new ArenaEngine({ persistence: otherPersistence, bank, judge: new ScriptedJudge([]), clock: () => 1000 });
      const matchId = await first.createMatch({ mode: "2v2", participants: [
        { userId: "cache-a", sideId: "left" }, { userId: "cache-mate", sideId: "left" },
        { userId: "cache-b", sideId: "right" }, { userId: "cache-other", sideId: "right" },
      ], problemVersionIds: ["even-ledger"] });
      await first.startRound(a, matchId);
      await first.beginCoding(a, matchId);
      const initial = await first.collabSync(a, matchId);
      await first.applyCollabUpdate(a, matchId, edit(initial, "\n# first edit"));
      const baseline = await second.collabSync(mate, matchId);
      return { first, second, matchId, baseline, bank, judge };
    }

    it("refreshes a cached baseline after another engine acknowledges an edit", async () => {
      const f = await fixture();
      const saved = await f.second.applyCollabUpdate(mate, f.matchId, edit(f.baseline, "\n# second edit"));
      const refreshed = await f.first.collabSync(a, f.matchId);
      expect(refreshed.revision).toBe(saved.revision);
      expect(refreshed.source).toBe(saved.source);
      await f.first.applyCollabUpdate(a, f.matchId, edit(refreshed, "\n# third edit"));
      const durable = await f.second.collabSync(mate, f.matchId);
      expect(durable.source).toContain("# second edit");
      expect(durable.source).toContain("# third edit");
    });

    it("preserves an acknowledged edit when a cached engine writes without a new sync", async () => {
      const f = await fixture();
      await f.second.applyCollabUpdate(mate, f.matchId, edit(f.baseline, "\n# second edit"));
      await f.first.applyCollabUpdate(a, f.matchId, edit(f.baseline, "\n# third edit"));
      const durable = await f.second.collabSync(mate, f.matchId);
      expect(durable.source).toContain("# second edit");
      expect(durable.source).toContain("# third edit");
    });

    it("submits the latest saved source from a cached engine", async () => {
      const f = await fixture();
      const saved = await f.second.applyCollabUpdate(mate, f.matchId, edit(f.baseline, SOLVED_PY, true));
      await f.first.setReady(a, f.matchId, { ready: true, documentRevision: saved.revision });
      await f.second.setReady(mate, f.matchId, { ready: true, documentRevision: saved.revision });
      const judged = vi.spyOn(f.judge, "evaluateSealed");
      await f.first.submit(a, f.matchId, { code: "client input is not authoritative", language: "Python", documentRevision: saved.revision });
      expect(judged).toHaveBeenCalledWith(expect.objectContaining({ source: saved.source }));
    });

    it("rejects an edit if the newer saved document cannot be loaded", async () => {
      const f = await fixture();
      await f.second.applyCollabUpdate(mate, f.matchId, edit(f.baseline, "\n# second edit"));
      const unavailable = vi.spyOn(persistence, "loadTeamDocument").mockResolvedValue(undefined);
      try {
        await expect(f.first.applyCollabUpdate(a, f.matchId, edit(f.baseline, "\n# unsafe edit")))
          .rejects.toThrow("saved team document is unavailable");
      } finally {
        unavailable.mockRestore();
      }
      const durable = await f.second.collabSync(mate, f.matchId);
      expect(durable.source).toContain("# second edit");
      expect(durable.source).not.toContain("# unsafe edit");
    });

    it("keeps pending out-of-order frames when the saved revision has not changed", async () => {
      const f = await fixture();
      const doc = new Y.Doc();
      Y.applyUpdate(doc, new Uint8Array(Buffer.from(f.baseline.stateB64, "base64")));
      const before = Y.encodeStateVector(doc);
      doc.getText("source").insert(doc.getText("source").length, "\n# predecessor");
      const predecessor = Buffer.from(Y.encodeStateAsUpdate(doc, before)).toString("base64");
      const middle = Y.encodeStateVector(doc);
      doc.getText("source").insert(doc.getText("source").length, "\n# successor");
      const successor = Buffer.from(Y.encodeStateAsUpdate(doc, middle)).toString("base64");
      doc.destroy();

      const pending = await f.first.applyCollabUpdate(a, f.matchId, { roundId: f.baseline.roundId, updateB64: successor });
      expect(pending.changed).toBe(false);
      await f.first.collabSync(a, f.matchId);
      await f.first.applyCollabUpdate(a, f.matchId, { roundId: f.baseline.roundId, updateB64: predecessor });
      const durable = await f.second.collabSync(mate, f.matchId);
      expect(durable.source).toContain("# predecessor");
      expect(durable.source).toContain("# successor");
    });

    function dependentFrames(sync: { roundId: string; stateB64: string }) {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, new Uint8Array(Buffer.from(sync.stateB64, "base64")));
      const before = Y.encodeStateVector(doc);
      const text = doc.getText("source");
      text.insert(text.length, "\n# predecessor");
      const predecessor = { roundId: sync.roundId, updateB64: Buffer.from(Y.encodeStateAsUpdate(doc, before)).toString("base64") };
      const middle = Y.encodeStateVector(doc);
      text.insert(text.length, "\n# successor");
      const successor = { roundId: sync.roundId, updateB64: Buffer.from(Y.encodeStateAsUpdate(doc, middle)).toString("base64") };
      doc.destroy();
      return { predecessor, successor };
    }

    it("keeps a pending frame across an unrelated saved edit", async () => {
      const f = await fixture();
      const frames = dependentFrames(f.baseline);
      expect((await f.first.applyCollabUpdate(a, f.matchId, frames.successor)).changed).toBe(false);
      await f.second.applyCollabUpdate(mate, f.matchId, edit(f.baseline, "\n# remote edit"));
      await f.first.collabSync(a, f.matchId);
      await f.first.applyCollabUpdate(a, f.matchId, frames.predecessor);
      const durable = await f.second.collabSync(mate, f.matchId);
      expect(durable.source).toContain("# predecessor");
      expect(durable.source).toContain("# successor");
      expect(durable.source).toContain("# remote edit");
    });

    it("does not publish resolved pending text under an older saved revision", async () => {
      const f = await fixture();
      const frames = dependentFrames(f.baseline);
      await f.first.applyCollabUpdate(a, f.matchId, frames.successor);
      const saved = await f.second.applyCollabUpdate(mate, f.matchId, frames.predecessor);
      const baseline = await f.first.collabSync(a, f.matchId);
      expect(baseline.source).toBe(saved.source);
      expect(baseline.revision).toBe(saved.revision);
      expect(baseline.source).not.toContain("# successor");
      await f.first.setReady(a, f.matchId, { ready: true, documentRevision: saved.revision });
      await f.second.setReady(mate, f.matchId, { ready: true, documentRevision: saved.revision });
      const applied = await f.first.applyCollabUpdate(a, f.matchId, frames.predecessor);
      expect(applied.revision).toBe(saved.revision + 1);
      expect(applied.source).toContain("# successor");
      const durable = await f.second.collabSync(mate, f.matchId);
      expect(durable.source).toBe(applied.source);
      const team = (await f.first.snapshot(a, f.matchId)).teams?.find((entry) => entry.side === "left");
      expect(team?.members.every((member) => !member.ready)).toBe(true);
    });

    it("keeps pending frames when a refresh loses a Match revision race", async () => {
      const f = await fixture();
      const frames = dependentFrames(f.baseline);
      await f.first.applyCollabUpdate(a, f.matchId, frames.successor);
      await f.second.applyCollabUpdate(mate, f.matchId, edit(f.baseline, "\n# remote edit"));
      let reached!: () => void;
      let release!: () => void;
      const atLoad = new Promise<void>((resolve) => { reached = resolve; });
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const load = persistence.loadTeamDocument.bind(persistence);
      const held = vi.spyOn(persistence, "loadTeamDocument").mockImplementationOnce(async (...args) => {
        reached();
        await gate;
        return load(...args);
      });
      const refresh = f.first.collabSync(a, f.matchId);
      const rejected = expect(refresh).rejects.toBeInstanceOf(MatchRevisionConflictError);
      try {
        await atLoad;
        const remote = await f.second.collabSync(mate, f.matchId);
        await f.second.applyCollabUpdate(mate, f.matchId, edit(remote, "\n# later remote edit"));
      } finally {
        release();
        held.mockRestore();
      }
      await rejected;
      await f.first.collabSync(a, f.matchId);
      await f.first.applyCollabUpdate(a, f.matchId, frames.predecessor);
      const durable = await f.second.collabSync(mate, f.matchId);
      expect(durable.source).toContain("# predecessor");
      expect(durable.source).toContain("# successor");
      expect(durable.source).toContain("# later remote edit");
    });

    it("rejects a deferred write that loses a race and reloads the winning document", async () => {
      const f = await fixture();
      const frames = dependentFrames(f.baseline);
      await f.first.applyCollabUpdate(a, f.matchId, frames.successor);
      await f.second.applyCollabUpdate(mate, f.matchId, edit(f.baseline, "\n# remote edit"));
      await f.first.collabSync(a, f.matchId);
      let reached!: () => void;
      let release!: () => void;
      const atCommit = new Promise<void>((resolve) => { reached = resolve; });
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const commit = persistence.commitMatchAndTeamDocuments.bind(persistence);
      const held = vi.spyOn(persistence, "commitMatchAndTeamDocuments").mockImplementationOnce(async (...args) => {
        reached();
        await gate;
        return commit(...args);
      });
      const losing = f.first.applyCollabUpdate(a, f.matchId, frames.predecessor);
      const rejected = expect(losing).rejects.toBeInstanceOf(MatchRevisionConflictError);
      try {
        await atCommit;
        await f.second.applyCollabUpdate(mate, f.matchId, edit(f.baseline, "\n# winning edit"));
      } finally {
        release();
        held.mockRestore();
      }
      await rejected;
      const recovered = await f.first.collabSync(a, f.matchId);
      expect(recovered.source).toContain("# winning edit");
      expect(recovered.source).not.toContain("# predecessor");
      expect(recovered.source).not.toContain("# successor");
      await f.first.applyCollabUpdate(a, f.matchId, edit(recovered, "\n# next edit"));
      const durable = await f.second.collabSync(mate, f.matchId);
      expect(durable.source).toContain("# winning edit");
      expect(durable.source).toContain("# next edit");
      expect(durable.source).not.toContain("# predecessor");
      expect(durable.source).not.toContain("# successor");
    });

    it("retains language reset history when another engine changes the language", async () => {
      const f = await fixture();
      await f.second.setTeamLanguage(mate, f.matchId, "C++");
      const cpp = await f.second.collabSync(mate, f.matchId);
      await f.first.setTeamLanguage(a, f.matchId, "Python");
      const duplicate = await f.first.applyCollabUpdate(a, f.matchId, { roundId: cpp.roundId, updateB64: cpp.stateB64 });
      expect(duplicate.changed).toBe(false);
      const restored = await f.second.collabSync(mate, f.matchId);
      expect(restored.language).toBe("Python");
      expect(restored.source).toBe(f.bank.loadProblem("even-ledger").starters.Python);
    });
  });
}
