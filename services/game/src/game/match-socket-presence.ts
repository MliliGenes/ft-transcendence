export type MatchSocketPresenceState = "online" | "offline";
export type MatchSocketPresenceMode = "1v1" | "2v2";

/**
 * Application boundary for socket presence. The tracker owns connection
 * counting; the target owns membership, match mode, and durable presence.
 */
export interface MatchSocketPresenceTarget {
  participantSide(userId: string, matchId: string): Promise<string>;
  modeOf(matchId: string): Promise<MatchSocketPresenceMode>;
  setPresence(matchId: string, side: string, presence: MatchSocketPresenceState): Promise<void>;
  setMemberPresence(matchId: string, userId: string, presence: MatchSocketPresenceState): Promise<void>;
}

/** Tracks live sockets without knowing about NestJS or Socket.IO. */
export class MatchSocketPresence {
    private stopped = false;

  private assertOpen(): void {
    if (this.stopped) throw new Error("socket presence stopped");
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const pending of this.opening.values()) pending.closed = true;
    this.sockets.clear(); this.opening.clear(); this.operations.clear();
  }

  private readonly sockets = new Map<string, Set<string>>();
  private readonly operations = new Map<string, Promise<void>>();
  private readonly opening = new Map<string, { closed: boolean }>();

  constructor(private readonly target: MatchSocketPresenceTarget) {}

  private socketKey(userId: string, matchId: string): string {
    return JSON.stringify([matchId, userId]);
  }

  private serialize<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.operations.get(key) ?? Promise.resolve();
    const result = previous.then(work);
    const tail = result.then(() => {}, () => {});
    this.operations.set(key, tail);
    return result.finally(() => {
      if (this.operations.get(key) === tail) this.operations.delete(key);
    });
  }

  /** Admission can be canceled while membership or durable Presence is pending. */
  noteSocketOpen(userId: string, matchId: string, socketId: string): Promise<string> {
    if (this.stopped) return Promise.reject(new Error("socket presence stopped"));
    const key = this.socketKey(userId, matchId);
    const pendingKey = JSON.stringify([matchId, userId, socketId]);
    const pending = { closed: false }; this.opening.set(pendingKey, pending);
    return this.serialize(key, async () => {
      let added = false;
      try {
        this.assertOpen();
        const side = await this.target.participantSide(userId, matchId);
        this.assertOpen();
        const mode = await this.target.modeOf(matchId);
        this.assertOpen();
        if (pending.closed) throw new Error("socket closed during admission");
        const set = this.sockets.get(key) ?? new Set<string>();
        if (set.has(socketId)) return side;
        set.add(socketId); added = true; this.sockets.set(key, set);
        if (set.size === 1) {
          this.assertOpen();
          if (mode === "2v2") await this.target.setMemberPresence(matchId, userId, "online");
          else await this.target.setPresence(matchId, side, "online");
          this.assertOpen();
        }
        return side;
      } catch (error) {
        if (added) {
          const set = this.sockets.get(key); set?.delete(socketId);
          if (set?.size === 0) this.sockets.delete(key);
        }
        throw error;
      } finally {
        if (this.opening.get(pendingKey) === pending) this.opening.delete(pendingKey);
      }
    });
  }

  /** The last close follows any pending write for this player and Match. */
  noteSocketClosed(userId: string, matchId: string, socketId: string): Promise<void> {
    if (this.stopped) return Promise.resolve();
    const key = this.socketKey(userId, matchId);
    const pending = this.opening.get(JSON.stringify([matchId, userId, socketId]));
    if (pending) pending.closed = true;
    return this.serialize(key, async () => {
      if (this.stopped) return;
      const set = this.sockets.get(key);
      if (!set || !set.delete(socketId) || set.size > 0) return;
      this.sockets.delete(key);
      try {
        const mode = await this.target.modeOf(matchId);
        if (this.stopped) return;
        if (mode === "2v2") await this.target.setMemberPresence(matchId, userId, "offline");
        else {
          const side = await this.target.participantSide(userId, matchId);
          if (this.stopped) return;
          await this.target.setPresence(matchId, side, "offline");
        }
      } catch {
        // Existing policy: later admission reconciles an unavailable Match.
      }
    });
  }
}
