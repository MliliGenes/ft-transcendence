import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import * as Y from "yjs";
import { CollabClient } from "../arena/collab.js";
import { MockArenaTransport } from "../arena/mock.js";
import { TestSocket } from "../../test/socket.js";
import { ArenaWorkspace } from "./ArenaWorkspace.js";

vi.mock("socket.io-client", () => ({ io: vi.fn() }));
const clients: CollabClient[] = [];
afterEach(() => { clients.splice(0).forEach((client) => client.dispose()); });

async function workspace() {
  const transport = new MockArenaTransport("2v2");
  await transport.beginCoding();
  transport.fixtureControls().setMateReady(true);
  await transport.setReady(true);
  const sockets: TestSocket[] = [];
  vi.mocked(io).mockImplementation(() => {
    const socket = new TestSocket(); sockets.push(socket);
    return socket as unknown as ReturnType<typeof io>;
  });
  const client = new CollabClient({ baseUrl: "http://arena.test", userId: "alice", matchId: "match", displayName: "Alice" });
  clients.push(client);
  const doc = new Y.Doc();
  doc.getText("source").insert(0, "saved source");
  const baseline = { roomId: "room", roundId: "round", side: "left", source: "saved source", revision: 1,
    language: "Python", stateB64: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64") };
  doc.destroy();
  const connecting = client.connect();
  sockets[0]!.server("sync", baseline);
  await connecting;
  const snapshot = transport.snapshot();
  const render = () => renderToStaticMarkup(<ArenaWorkspace snapshot={snapshot} transport={transport}
    code={client.getSource()} onCode={() => {}} collab={client} />);
  return { client, sockets, baseline, snapshot, render };
}

describe("shared workspace acceptance", () => {
  it("pauses Run and Readiness until edits and the Match snapshot agree", async () => {
    const f = await workspace();
    f.client.ytext.insert(f.client.ytext.length, " edited");
    expect(f.render().match(/<button[^>]*>Run<\/button>/)?.[0]).toContain('disabled=""');
    expect(f.render().match(/<input[^>]*type="checkbox"[^>]*>/)?.[0]).toContain('disabled=""');
    f.sockets[0]!.outgoing.at(-1)!.ack({ ok: true, revision: 2 });
    expect(f.render().match(/<button[^>]*>Run<\/button>/)?.[0]).toContain('disabled=""');
    f.snapshot.docRevision = 2;
    expect(f.render().match(/<button[^>]*>Run<\/button>/)?.[0]).not.toContain('disabled=""');
  });

  it("shows rejected text separately from the restored editor document", async () => {
    const f = await workspace();
    f.client.ytext.insert(f.client.ytext.length, " recovery text");
    f.sockets[0]!.outgoing.at(-1)!.ack({ ok: false, error: "write failed" });
    f.sockets.at(-1)!.server("sync", f.baseline);
    for (let n = 0; n < 10; n++) await Promise.resolve();
    expect(f.client.getSource()).toBe("saved source");
    expect(f.render()).toContain('aria-label="Recovery text"');
    expect(f.render()).toContain("saved source recovery text");
    expect(f.render().match(/<button[^>]*>Run<\/button>/)?.[0]).toContain('disabled=""');
    f.client.clearRecovery();
    expect(f.render()).not.toContain('aria-label="Recovery text"');
  });
});
