import type { LobbyClient, LobbySideId, RoomWithMembers } from "./lobby.js";
import type { MatchMode } from "./types.js";

export type LobbySessionClient = Pick<
  LobbyClient,
  | "getActive"
  | "cancelQueue"
  | "createRoom"
  | "joinRoom"
  | "setSide"
  | "setReady"
  | "leaveRoom"
  | "startRoom"
  | "connectSocket"
  | "joinRoomChannel"
  | "leaveRoomChannel"
>;

export interface LobbySessionSnapshot {
  mode: MatchMode;
  roomData: RoomWithMembers | null;
  error: string | null;
}

function matchedQueueId(queue?: { status: string; matchedMatchId: string | null } | null): string | null {
  return queue?.status === "matched" ? queue.matchedMatchId : null;
}

function matchedRoomId(room?: { room: { status: string; matchId: string | null } } | null): string | null {
  return room?.room.status === "matched" ? room.room.matchId : null;
}

/**
 * Owns Lobby recovery and client-side convergence around the authoritative
 * active-state endpoint. Socket payloads and mutation responses only trigger
 * a refresh; they never replace the latest Lobby snapshot directly.
 */
export class LobbySession {
  private snapshot: LobbySessionSnapshot;
  private readonly listeners = new Set<() => void>();
  private requestVersion = 0;
  private currentRefresh: Promise<void> | null = null;
  private socketRecovery: Promise<void> | null = null;
  private lifetimeVersion = 0;
  private socketCleanup?: () => void;
  private active = false;
  private joinedRoomId: string | null = null;
  private readonly handedOffMatches = new Set<string>();

  constructor(
    private readonly client: LobbySessionClient,
    private readonly onMatchFound: (matchId: string) => void,
    initialMode: MatchMode = "1v1",
  ) {
    this.snapshot = { mode: initialMode, roomData: null, error: null };
  }

  getSnapshot = (): LobbySessionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start(): Promise<void> {
    if (!this.socketCleanup) {
      this.active = true;
      const lifetimeVersion = ++this.lifetimeVersion;
      const refresh = () => {
        if (this.isCurrentLifetime(lifetimeVersion))
          void this.refresh(this.socketRecovery !== null, this.socketRecovery !== null).catch(() => {});
      };
      this.socketCleanup = this.client.connectSocket({
        onConnect: () => {
          if (!this.isCurrentLifetime(lifetimeVersion)) return;
          this.joinedRoomId = null;
          const recovery = this.refresh(true, true).finally(() => {
            if (this.socketRecovery === recovery) this.socketRecovery = null;
          });
          this.socketRecovery = recovery;
          return recovery;
        },
        onRoomUpdated: refresh,
        onMatchFound: refresh,
        onQueueMatched: refresh,
      });
    }
    return this.refresh();
  }

  stop(): void {
    this.active = false;
    this.lifetimeVersion += 1;
    this.requestVersion += 1;
    this.socketCleanup?.();
    this.socketCleanup = undefined;
    this.joinedRoomId = null;
    this.currentRefresh = null;
    this.socketRecovery = null;
  }

  setMode(mode: MatchMode): void {
    if (this.snapshot.roomData) return;
    this.update({ mode });
  }

  refresh(propagateError = false, recoveringSocket = false): Promise<void> {
    const refresh = this.readActive(propagateError, recoveringSocket);
    this.currentRefresh = refresh;
    return refresh;
  }

  private handleMatched(matchId: string): void {
    this.handoff(matchId);
    this.applyRoom(null);
  }

  private isCurrentRequest(lifetimeVersion: number, requestVersion: number): boolean {
    return this.isCurrentLifetime(lifetimeVersion) && requestVersion === this.requestVersion;
  }

  private async waitForCurrentRequest(propagateError: boolean, lifetimeVersion: number): Promise<void> {
    if (propagateError && this.isCurrentLifetime(lifetimeVersion)) {
      await this.currentRefresh;
    }
  }

  private async handleWaitingQueue(
    recoveringSocket: boolean,
    lifetimeVersion: number,
    requestVersion: number,
    propagateError: boolean,
  ): Promise<{ continue: boolean; activeState: Awaited<ReturnType<LobbySessionClient["getActive"]>> }> {
    if (recoveringSocket) {
      this.applyRoom(null);
      const lifetime = this.lifetimeVersion;
      void this.socketRecovery?.then(() => {
        if (this.isCurrentLifetime(lifetime)) void this.refresh();
      }).catch(() => {});
      return { continue: false, activeState: { room: null, queue: null } };
    }
    const cancelled = await this.client.cancelQueue();
    if (!this.isCurrentRequest(lifetimeVersion, requestVersion)) {
      await this.waitForCurrentRequest(propagateError, lifetimeVersion);
      return { continue: false, activeState: { room: null, queue: null } };
    }
    if (cancelled.matched && cancelled.matchId) {
      this.handleMatched(cancelled.matchId);
      return { continue: false, activeState: { room: null, queue: null } };
    }
    const activeState = await this.client.getActive();
    if (!this.isCurrentRequest(lifetimeVersion, requestVersion)) {
      await this.waitForCurrentRequest(propagateError, lifetimeVersion);
      return { continue: false, activeState: { room: null, queue: null } };
    }
    return { continue: true, activeState };
  }

  private async reconcileActive(
    activeState: Awaited<ReturnType<LobbySessionClient["getActive"]>>,
    recoveringSocket: boolean,
    lifetimeVersion: number,
    requestVersion: number,
    propagateError: boolean,
  ): Promise<boolean> {
    const queueMatch = matchedQueueId(activeState.queue);
    if (queueMatch) {
      this.handleMatched(queueMatch);
      return false;
    }

    let current = activeState;
    if (current.queue?.status === "waiting") {
      const waiting = await this.handleWaitingQueue(recoveringSocket, lifetimeVersion, requestVersion, propagateError);
      if (!waiting.continue) return false;
      current = waiting.activeState;
    }

    const roomMatch = matchedRoomId(current.room);
    if (roomMatch) {
      this.handleMatched(roomMatch);
      return false;
    }

    const roomData = current.room?.room.status === "open" ? current.room : null;
    return this.applyRoom(roomData);
  }

  private async readActive(propagateError: boolean, recoveringSocket: boolean): Promise<void> {
    if (!this.active) return;
    const requestVersion = ++this.requestVersion;
    const lifetimeVersion = this.lifetimeVersion;
    this.update({ error: null });
    try {
      const activeState = await this.client.getActive();
      if (!this.isCurrentRequest(lifetimeVersion, requestVersion)) {
        await this.waitForCurrentRequest(propagateError, lifetimeVersion);
        return;
      }

      const shouldRefresh = await this.reconcileActive(
        activeState,
        recoveringSocket,
        lifetimeVersion,
        requestVersion,
        propagateError,
      );
      if (shouldRefresh) await this.refresh(propagateError, recoveringSocket);
    } catch (error) {
      if (!this.isCurrentRequest(lifetimeVersion, requestVersion)) {
        await this.waitForCurrentRequest(propagateError, lifetimeVersion);
        return;
      }
      this.update({ error: this.message(error, "Failed to recover lobby") });
      if (propagateError) throw error;
    }
  }

  async createRoom(): Promise<void> {
    await this.mutate(() => this.client.createRoom(this.snapshot.mode));
  }

  joinRoom(code: string): Promise<boolean> {
    return this.mutate(() => this.client.joinRoom(code));
  }

  async setSide(side: LobbySideId): Promise<void> {
    const roomId = this.snapshot.roomData?.room.id;
    if (!roomId) return;
    await this.mutate(() => this.client.setSide(roomId, side));
  }

  async setReady(ready: boolean): Promise<void> {
    const roomId = this.snapshot.roomData?.room.id;
    if (!roomId) return;
    await this.mutate(() => this.client.setReady(roomId, ready));
  }

  async leaveRoom(): Promise<void> {
    const roomId = this.snapshot.roomData?.room.id;
    if (!roomId) return;
    await this.mutate(() => this.client.leaveRoom(roomId));
  }

  async startRoom(): Promise<void> {
    const roomId = this.snapshot.roomData?.room.id;
    if (!roomId || !this.active) return;
    const lifetimeVersion = this.lifetimeVersion;
    this.update({ error: null });
    try {
      const result = await this.client.startRoom(roomId);
      if (this.isCurrentLifetime(lifetimeVersion)) this.handoff(result.matchId);
    } catch (error) {
      if (this.isCurrentLifetime(lifetimeVersion)) this.update({ error: this.message(error, "Failed to start room") });
    }
  }

  private isCurrentLifetime(version: number): boolean {
    return this.active && version === this.lifetimeVersion;
  }

  private async mutate(action: () => Promise<unknown>): Promise<boolean> {
    if (!this.active) return false;
    const lifetimeVersion = this.lifetimeVersion;
    this.update({ error: null });
    try {
      await action();
      if (!this.isCurrentLifetime(lifetimeVersion)) return false;
      await this.refresh();
      return this.isCurrentLifetime(lifetimeVersion);
    } catch (error) {
      if (this.isCurrentLifetime(lifetimeVersion)) this.update({ error: this.message(error, "Failed to update lobby") });
      return false;
    }
  }

  private applyRoom(roomData: RoomWithMembers | null): boolean {
    const nextRoomId = roomData?.room.id ?? null;
    let joinedRoom = false;
    if (this.joinedRoomId !== nextRoomId) {
      if (this.joinedRoomId) this.client.leaveRoomChannel(this.joinedRoomId);
      if (nextRoomId) {
        this.client.joinRoomChannel(nextRoomId);
        joinedRoom = true;
      }
      this.joinedRoomId = nextRoomId;
    }
    this.update({
      roomData,
      ...(roomData ? { mode: roomData.room.mode } : {}),
    });
    return joinedRoom;
  }

  private handoff(matchId: string): void {
    if (this.handedOffMatches.has(matchId)) return;
    this.handedOffMatches.add(matchId);
    this.onMatchFound(matchId);
  }

  private message(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  private update(changes: Partial<LobbySessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...changes };
    for (const listener of this.listeners) listener();
  }
}
