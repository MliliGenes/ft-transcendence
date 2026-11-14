import { Injectable } from '@nestjs/common';

export type PresenceStatus = 'ONLINE' | 'AWAY' | 'OFFLINE';

export type PresenceChange = {
  userId: string;
  status: PresenceStatus;
};

const AWAY_AFTER_MS = 5 * 60 * 1000;
const MIN_ACTIVITY_INTERVAL_MS = 5 * 1000;

@Injectable()
export class PresenceService {
  private readonly socketsByUser = new Map<string, Map<string, number>>();
  private readonly statusByUser = new Map<string, PresenceStatus>();

  connect(userId: string, socketId: string): PresenceChange | null {
    const sockets = this.socketsByUser.get(userId) ?? new Map();
    this.socketsByUser.set(userId, sockets);
    // A newly connected socket represents fresh activity. Starting it at the
    // away threshold makes a connected user appear away until their first input.
    sockets.set(socketId, Date.now());
    return this.updateStatus(userId);
  }

  recordActivity(userId: string, socketId: string): PresenceChange | null {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets?.has(socketId)) return null;
    const now = Date.now();
    if (now - sockets.get(socketId)! < MIN_ACTIVITY_INTERVAL_MS) return null;
    sockets.set(socketId, now);
    return this.updateStatus(userId);
  }

  disconnect(userId: string, socketId: string): PresenceChange | null {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets?.delete(socketId)) return null;
    if (!sockets.size) this.socketsByUser.delete(userId);
    return this.updateStatus(userId);
  }

  expireIdleUsers(): PresenceChange[] {
    const now = Date.now();
    const changes: PresenceChange[] = [];
    for (const userId of this.socketsByUser.keys()) {
      const change = this.updateStatus(userId, now);
      if (change) changes.push(change);
    }
    return changes;
  }

  getStatuses(userIds: string[]) {
    return userIds.map((userId) => ({
      userId,
      status: this.statusByUser.get(userId) ?? 'OFFLINE',
    }));
  }

  private updateStatus(
    userId: string,
    now = Date.now(),
  ): PresenceChange | null {
    const previous = this.statusByUser.get(userId) ?? 'OFFLINE';
    const sockets = this.socketsByUser.get(userId);
    const status: PresenceStatus = !sockets?.size
      ? 'OFFLINE'
      : [...sockets.values()].some(
            (lastActivity) => now - lastActivity < AWAY_AFTER_MS,
          )
        ? 'ONLINE'
        : 'AWAY';

    if (status === 'OFFLINE') this.statusByUser.delete(userId);
    else this.statusByUser.set(userId, status);

    return status === previous ? null : { userId, status };
  }
}
