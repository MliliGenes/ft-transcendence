export type MatchSocketPresenceState = 'online' | 'offline';
export type MatchSocketPresenceMode = '1v1' | '2v2';

/**
 * Application boundary for socket presence. The tracker owns connection
 * counting; the target owns membership, match mode, and durable presence.
 */
export interface MatchSocketPresenceTarget {
  participantSide(userId: string, matchId: string): Promise<string>;
  modeOf(matchId: string): Promise<MatchSocketPresenceMode>;
  setPresence(
    matchId: string,
    side: string,
    presence: MatchSocketPresenceState,
  ): Promise<void>;
  setMemberPresence(
    matchId: string,
    userId: string,
    presence: MatchSocketPresenceState,
  ): Promise<void>;
}

/** Tracks live sockets without knowing about NestJS or Socket.IO. */
export class MatchSocketPresence {
  private readonly sockets = new Map<string, Set<string>>();
  private readonly transitions = new Map<string, Promise<void>>();

  constructor(private readonly target: MatchSocketPresenceTarget) {}

  private socketKey(userId: string, matchId: string): string {
    return `${matchId}:${userId}`;
  }

  /** Keep each user's live socket count ordered with its durable presence writes. */
  private serialize<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.transitions.get(key) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    const settled = current.then(
      () => undefined,
      () => undefined,
    );
    this.transitions.set(key, settled);
    void settled.then(() => {
      if (this.transitions.get(key) === settled) this.transitions.delete(key);
    });
    return current;
  }

  /** Socket open: the first socket flips presence online. */
  async noteSocketOpen(
    userId: string,
    matchId: string,
    socketId: string,
  ): Promise<string> {
    const key = this.socketKey(userId, matchId);
    return this.serialize(key, async () => {
      const side = await this.target.participantSide(userId, matchId);
      let set = this.sockets.get(key);
      if (!set) {
        set = new Set();
        this.sockets.set(key, set);
      }
      set.add(socketId);
      if (set.size === 1) {
        if ((await this.target.modeOf(matchId)) === '2v2') {
          await this.target.setMemberPresence(matchId, userId, 'online');
        } else {
          await this.target.setPresence(matchId, side, 'online');
        }
      }
      return side;
    });
  }

  /** Socket close: presence goes offline only when its last socket drops. */
  async noteSocketClosed(
    userId: string,
    matchId: string,
    socketId: string,
  ): Promise<void> {
    const key = this.socketKey(userId, matchId);
    return this.serialize(key, async () => {
      const set = this.sockets.get(key);
      if (!set || !set.delete(socketId)) return;
      if (set.size > 0) return;
      try {
        if ((await this.target.modeOf(matchId)) === '2v2') {
          await this.target.setMemberPresence(matchId, userId, 'offline');
        } else {
          const side = await this.target.participantSide(userId, matchId);
          await this.target.setPresence(matchId, side, 'offline');
        }
      } catch {
        // Match gone or stranger: nothing to mark.
      }
      if (set.size === 0) this.sockets.delete(key);
    });
  }
}
