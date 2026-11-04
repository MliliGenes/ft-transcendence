import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresenceService } from '../src/chat/presence.service.js';

describe('PresenceService', () => {
  afterEach(() => vi.useRealTimers());

  it('tracks online, away, and offline across multiple sockets', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
    const presence = new PresenceService();

    expect(presence.connect('user-1', 'socket-1')).toEqual({
      userId: 'user-1',
      status: 'AWAY',
    });
    expect(presence.recordActivity('user-1', 'socket-1')).toEqual({
      userId: 'user-1',
      status: 'ONLINE',
    });
    expect(presence.connect('user-1', 'socket-2')).toBeNull();

    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(presence.expireIdleUsers()).toEqual([
      { userId: 'user-1', status: 'AWAY' },
    ]);
    expect(presence.recordActivity('user-1', 'socket-2')).toEqual({
      userId: 'user-1',
      status: 'ONLINE',
    });

    expect(presence.disconnect('user-1', 'socket-1')).toBeNull();
    expect(presence.disconnect('user-1', 'socket-2')).toEqual({
      userId: 'user-1',
      status: 'OFFLINE',
    });
  });

  it('ignores activity from a socket that is not connected', () => {
    const presence = new PresenceService();
    expect(presence.recordActivity('user-1', 'unknown')).toBeNull();
  });
});
