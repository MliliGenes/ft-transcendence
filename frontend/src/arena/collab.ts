import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";

/** Canonical Y.Text key — must match the server's COLLAB_TEXT_KEY. */
export const COLLAB_TEXT_KEY = "source";

export interface CollabSyncPayload {
  roomId: string;
  roundId: string;
  side: string;
  stateB64: string;
  source: string;
  revision: number;
  language: string;
}

export interface PeerCursor {
  userId: string;
  clientId: number | null;
  anchor: number | null;
  head: number | null;
  displayName: string | null;
  color: string | null;
}

export type CollabConnection = "connecting" | "connected" | "reconnecting" | "offline";

/**
 * Deterministic cursor color per user (accessibility: color is never the
 * ONLY identity signal — the collaborator label carries the displayName).
 */
export function colorForUser(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 40%)`;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

/**
 * Single-client awareness update encoder (y-protocols wire format:
 * varUint(1), varUint(clientId), varUint(clock), varString(JSON state)).
 * Lets the socket relay feed y-codemirror.next's remote-cursor rendering
 * through the REAL Awareness store — no parallel cursor table, no fake DOM.
 */
function encodeRemoteCursor(clientId: number, clock: number, state: unknown): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(state));
  const out: number[] = [];
  const varUint = (n: number): void => {
    while (n > 127) {
      out.push(128 | (n & 127));
      n >>>= 7;
    }
    out.push(n);
  };
  varUint(1);
  varUint(clientId);
  varUint(clock);
  varUint(json.length);
  for (const b of json) out.push(b);
  return new Uint8Array(out);
}

/**
 * Collaboration provider (ticket 15): owns ONE Y.Doc bound to the team
 * Y.Text via y-codemirror.next (see EditorAdapter collab mode), syncing
 * incremental Yjs frames over the separate /collab namespace.
 *
 * game socket  = RoundPhase / readiness / submit / reveal authority
 * this socket  = Yjs updates + cursor awareness only (never game state)
 *
 * Offline policy (§20, safe default): while disconnected the shared editor
 * goes read-only (see CodeWorkspace) — no unbounded offline CRDT editing
 * that could surprise readiness or frozen-submit semantics. Reconnect
 * re-applies the authoritative baseline. Unconfirmed edits use a fresh document.
 */
export class CollabClient {
  private currentDoc = new Y.Doc();
  /** Ephemeral cursor store backing y-codemirror.next remote rendering. */
  private currentAwareness: Awareness;
  revision: number | null = null;
  language: string | null = null;
  roundId: string | null = null;
  private socket: Socket | null = null;
  private lifetime: AbortController | null = null;
  private connecting: Promise<CollabSyncPayload> | null = null;
  private baseline: CollabSyncPayload | null = null;
  private disposed = false;
  private conn: CollabConnection = "connecting";
  private readonly listeners = new Set<() => void>();
  /** userId -> Y clientId for peer-left cleanup. */
  private readonly peerIds = new Map<string, number>();
  /** Synthetic per-peer awareness clocks (strictly increasing per clientId). */
  private readonly peerClocks = new Map<number, number>();
  /** True while applying server frames: suppresses echo back to the server. */
  private applyingRemote = false;
  private readonly pendingUpdates = new Set<symbol>();
  private resetOnSync = false;
  private readonly recoveries = new Map<string, string>();
  private lastError: string | null = null;

  constructor(
    private readonly options: {
      baseUrl: string;
      userId: string;
      matchId: string;
      displayName: string;
      getAccessToken?: () => string | null;
      onAuthExpired?: () => Promise<unknown>;
    },
  ) {
    this.currentAwareness = new Awareness(this.doc);
    this.bindDocument();
  }

  get doc(): Y.Doc { return this.currentDoc; }
  get awareness(): Awareness { return this.currentAwareness; }
  get hasPendingUpdates(): boolean { return this.pendingUpdates.size > 0; }
  get error(): string | null { return this.lastError; }
  get recoverySource(): string | null {
    const key = this.recoveryKey();
    return key ? this.recoveries.get(key) ?? null : null;
  }

  clearRecovery(): void {
    const key = this.recoveryKey();
    if (key) this.recoveries.delete(key);
    this.lastError = null;
    try { if (key && typeof window !== "undefined") window.localStorage.removeItem(key); } catch { /* Keep working when storage is blocked. */ }
    this.emit();
  }

  private recoveryKey(): string | null {
    if (!this.roundId || !this.language) return null;
    return `arena-recovery:${JSON.stringify([this.options.baseUrl, this.options.userId, this.options.matchId, this.roundId, this.language])}`;
  }

  private saveRecovery(): void {
    const key = this.recoveryKey();
    if (!key) return;
    const source = this.getSource();
    this.recoveries.set(key, source);
    try { if (typeof window !== "undefined") window.localStorage.setItem(key, source); } catch { /* The recovery copy remains in memory. */ }
  }

  private captureUnconfirmed(): void {
    if (!this.hasPendingUpdates) return;
    this.saveRecovery();
    this.resetOnSync = true;
    this.lastError = "Edit confirmation was lost. Your text is available below.";
  }

  private bindDocument(): void {
    const doc = this.doc;
    this.awareness.setLocalStateField("user", {
      name: this.options.displayName, color: colorForUser(this.options.userId),
    });
    doc.on("update", (update: Uint8Array) => {
      if (this.applyingRemote || doc !== this.doc) return;
      const sock = this.socket;
      const lifetime = this.lifetime;
      if (!sock || !lifetime || this.conn !== "connected" || !this.roundId) {
        if (this.resetOnSync) this.saveRecovery();
        return;
      }
      const pending = Symbol();
      this.pendingUpdates.add(pending);
      this.emit();
      sock.timeout(5_000).emit("update", { roundId: this.roundId, updateB64: bytesToB64(update) },
        (error: Error | null, result?: { ok: boolean; revision?: number; error?: string }) => {
          if (this.socket !== sock || lifetime.signal.aborted) return;
          this.pendingUpdates.delete(pending);
          if (error || !result?.ok || !Number.isSafeInteger(result.revision) || result.revision! < 1) {
            this.saveRecovery();
            this.resetOnSync = true;
            this.lastError = error ? "Edit confirmation was lost. Your text is available below." : "The edit was not saved. Your text is available below.";
            this.stopSocket();
            this.setConn("reconnecting");
            void this.connect().catch(() => {});
            return;
          }
          this.revision = Math.max(this.revision ?? 0, result.revision!);
          this.emit();
        });
    });
  }

  private replaceDocument(): void {
    const previous = this.doc;
    this.currentDoc = new Y.Doc();
    previous.destroy();
    this.peerIds.clear();
    this.peerClocks.clear();
    this.currentAwareness = new Awareness(this.doc);
    this.bindDocument();
  }

  /** Handshake auth: Bearer token when a shared session exists, else DEV identity. */
  private collabAuth(): Record<string, string> {
    const token = this.options.getAccessToken?.();
    return token
      ? { accessToken: token, matchId: this.options.matchId }
      : { userId: this.options.userId, matchId: this.options.matchId };
  }

  /**
   * Explicit renewal: a fresh socket on the same document — the Yjs doc is
   * kept (unconfirmed edits fall back to the recovery copy); the server
   * re-sends the authoritative baseline on connect.
   */
  renewSocket(): Promise<CollabSyncPayload> {
    this.stopSocket();
    return this.connect();
  }

  /** A changed language or a missed accepted frame requires a fresh document baseline. */
  async reconcile(revision: number | null, language: string): Promise<void> {
    if (this.disposed || this.connecting || this.conn !== "connected" || this.hasPendingUpdates || revision === null) return;
    if (this.revision !== null && revision < this.revision) return;
    if (revision === this.revision && language === this.language) return;
    this.resetOnSync = true;
    this.stopSocket();
    await this.connect();
  }

  get ytext(): Y.Text {
    return this.doc.getText(COLLAB_TEXT_KEY);
  }

  getSource(): string {
    return this.ytext.toString();
  }

  connection(): CollabConnection {
    return this.conn;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setConn(next: CollabConnection): void {
    if (this.conn !== next) {
      this.conn = next;
      this.emit();
    }
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  /** Applies one accepted server frame (idempotent: duplicates change nothing). */
  applyRemoteUpdate(updateB64: string): void {
    this.applyingRemote = true;
    try {
      Y.applyUpdate(this.doc, b64ToBytes(updateB64));
    } finally {
      this.applyingRemote = false;
    }
  }

  /**
   * Applies a teammate cursor into the awareness store (never the document).
   * y-codemirror.next renders remote selections from Y RELATIVE positions,
   * so numeric transport offsets are converted against the live Y.Text here.
   * Unconvertible offsets are dropped: cursors are ephemeral, the doc is not.
   */
  applyPeerCursor(cursor: PeerCursor): void {
    if (cursor.clientId === null || cursor.clientId === this.doc.clientID) return;
    if (cursor.userId) this.peerIds.set(cursor.userId, cursor.clientId);
    const metaClock = this.awareness.meta.get(cursor.clientId)?.clock ?? 0;
    const localClock = this.peerClocks.get(cursor.clientId) ?? 0;
    const clock = Math.max(metaClock, localClock) + 1;
    this.peerClocks.set(cursor.clientId, clock);
    let rel: { anchor: Y.RelativePosition | null; head: Y.RelativePosition | null } | null = null;
    if (typeof cursor.anchor === "number" && typeof cursor.head === "number") {
      try {
        rel = {
          anchor: Y.createRelativePositionFromTypeIndex(this.ytext, cursor.anchor),
          head: Y.createRelativePositionFromTypeIndex(this.ytext, cursor.head),
        };
      } catch {
        rel = null;
      }
    }
    applyAwarenessUpdate(
      this.awareness,
      encodeRemoteCursor(cursor.clientId, clock, {
        cursor: rel,
        user: { name: cursor.displayName ?? cursor.userId, color: cursor.color ?? colorForUser(cursor.userId) },
      }),
      "socket",
    );
  }

  /** Drops a departed teammate's cursor (awareness only). */
  removePeer(userId: string): void {
    const id = this.peerIds.get(userId);
    if (id === undefined) return;
    this.peerIds.delete(userId);
    this.peerClocks.delete(id);
    removeAwarenessStates(this.awareness, [id], "socket");
  }

  /**
   * Publishes the local cursor (called on editor selection change). The local
   * awareness field keeps y-codemirror.next's relative-position shape (the
   * binding rewrites it the same way); the socket carries plain offsets.
   */
  setLocalCursor(anchor: number | null, head: number | null): void {
    let rel: { anchor: Y.RelativePosition | null; head: Y.RelativePosition | null } | null = null;
    if (anchor !== null && head !== null) {
      try {
        rel = {
          anchor: Y.createRelativePositionFromTypeIndex(this.ytext, anchor),
          head: Y.createRelativePositionFromTypeIndex(this.ytext, head),
        };
      } catch {
        rel = null;
      }
    }
    this.awareness.setLocalStateField("cursor", rel);
    const sock = this.socket;
    if (!sock || this.conn !== "connected") return;
    sock.emit(
      "cursor",
      {
        clientId: this.doc.clientID,
        anchor,
        head,
        displayName: this.options.displayName,
        color: colorForUser(this.options.userId),
      },
      () => {},
    );
  }

  /**
   * Applies the authoritative baseline. Ordinary rejoins merge idempotently.
   * Unconfirmed edits and language changes replace the document first.
   * A new client per Round keeps retired Round content isolated.
   */
  applySync(sync: CollabSyncPayload): void {
    if (this.resetOnSync) { this.replaceDocument(); this.resetOnSync = false; }
    this.applyingRemote = true;
    try {
      if (sync.stateB64) Y.applyUpdate(this.doc, b64ToBytes(sync.stateB64));
    } finally {
      this.applyingRemote = false;
    }
    this.baseline = sync;
    this.roundId = sync.roundId;
    this.revision = sync.revision;
    this.language = sync.language;
    const key = this.recoveryKey();
    try {
      const source = key && typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      if (key && source !== null) this.recoveries.set(key, source);
    } catch { /* Use the in-memory recovery copy. */ }
    this.emit();
  }

  connect(): Promise<CollabSyncPayload> {
    if (this.disposed) return Promise.reject(new Error("Collaboration client is disposed"));
    if (this.connecting) return this.connecting;
    if (this.conn === "connected" && this.socket?.connected && this.baseline) return Promise.resolve(this.baseline);
    this.stopSocket();
    const lifetime = new AbortController();
    this.lifetime = lifetime;
    this.setConn("connecting");
    const sock = io(`${this.options.baseUrl}/collab`, {
      auth: this.collabAuth(),
      forceNew: true,
      autoConnect: false,
    });
    this.socket = sock;
    const active = () => this.socket === sock && !lifetime.signal.aborted;
    sock.on("sync", (sync: CollabSyncPayload) => {
      if (!active()) return;
      this.applySync(sync);
      this.setConn("connected");
    });
    sock.on("remote-update", (p: { updateB64: string; revision: number }) => {
      if (!active()) return;
      this.applyRemoteUpdate(p.updateB64);
      this.revision = Math.max(this.revision ?? 0, p.revision);
      this.emit();
    });
    sock.on("peer-cursor", (p: PeerCursor) => {
      if (active()) this.applyPeerCursor(p);
    });
    sock.on("peer-left", (p: { userId: string }) => {
      if (active() && p && typeof p.userId === "string") this.removePeer(p.userId);
    });
    sock.on("disconnect", () => {
      if (active()) { this.captureUnconfirmed(); this.setConn("reconnecting"); }
    });
    sock.on("connect_error", () => {
      if (active()) this.setConn("reconnecting");
    });
    const wait = new Promise<CollabSyncPayload>((resolve, reject) => {
      const finish = (error?: Error, sync?: CollabSyncPayload) => {
        clearTimeout(timer);
        sock.off("sync", synced);
        sock.off("connect_error", failed);
        sock.off("disconnect", denied);
        lifetime.signal.removeEventListener("abort", cancelled);
        if (error) reject(error);
        else resolve(sync!);
      };
      const synced = (sync: CollabSyncPayload) => finish(undefined, sync);
      const failed = (error: Error) => {
        if (!sock.active) finish(error);
      };
      const denied = () => finish(new Error("Collaboration room refused"));
      const cancelled = () => finish(new Error("Collaboration connection cancelled"));
      const timer = setTimeout(() => finish(new Error("Collaboration connection timed out")), 10_000);
      sock.once("sync", synced);
      sock.on("connect_error", failed);
      sock.once("disconnect", denied);
      lifetime.signal.addEventListener("abort", cancelled, { once: true });
    });
    const connecting = wait.catch((error: Error) => {
      if (active()) {
        this.stopSocket();
        this.lastError = error.message;
        this.setConn("offline");
      }
      throw error;
    }).finally(() => {
      if (this.connecting === connecting) this.connecting = null;
    });
    this.connecting = connecting;
    sock.connect();
    return connecting;
  }

  private stopSocket(): void {
    this.captureUnconfirmed();
    this.lifetime?.abort();
    this.pendingUpdates.clear();
    this.lifetime = null;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.connecting = null;
    for (const userId of this.peerIds.keys()) this.removePeer(userId);
  }

  /** Stop transport while preserving this Round's document for a rejoin. */
  disconnect(): void {
    this.stopSocket();
    this.setConn("offline");
  }

  /** Permanently release a replaced Round, including the awareness heartbeat. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disconnect();
    this.doc.destroy(); // Awareness observes document destruction and stops its interval.
    this.listeners.clear();
  }
}
