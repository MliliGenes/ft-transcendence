import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameService } from './game.service.js';
import type { GameEventsPublisher } from './game-events.publisher.js';

type PublishedEvent = { type: string; data: unknown };

function stubPublisher() {
  const published: PublishedEvent[] = [];
  const publishMatchStarted = vi.fn(async (data: unknown) => {
    published.push({ type: 'game.match.started', data });
    return true;
  });
  const publishMatchEnded = vi.fn(async (data: unknown) => {
    published.push({ type: 'game.match.ended', data });
    return true;
  });
  const publishChallengeCancelled = vi.fn(async (data: unknown) => {
    published.push({ type: 'game.challenge.cancelled', data });
    return true;
  });
  const publisher = {
    publishMatchStarted,
    publishMatchEnded,
    publishChallengeCancelled,
  } as unknown as GameEventsPublisher;
  return { publisher, published, publishChallengeCancelled, publishMatchEnded };
}

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

describe('Game service lifecycle events', () => {
  let game: GameService;
  let publisher: GameEventsPublisher;
  let published: PublishedEvent[];
  let publishChallengeCancelled: ReturnType<typeof vi.fn>;
  let publishMatchEnded: ReturnType<typeof vi.fn>;
  let now: number;

  beforeEach(async () => {
    published = [];
    ({ publisher, published, publishChallengeCancelled, publishMatchEnded } =
      stubPublisher());
    now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    game = new GameService(publisher);
    await game.onModuleInit();
  });

  afterEach(async () => {
    await game.onModuleDestroy();
    vi.restoreAllMocks();
  });

  async function readyRoom() {
    const created = await game.createPrivateRoom(ALICE, '1v1');
    await game.joinPrivateRoom(BOB, created.room.code);
    await game.setRoomMemberReady(ALICE, created.room.id, true);
    await game.setRoomMemberReady(BOB, created.room.id, true);
    return created;
  }

  it('announces a started match with its room code and participants', async () => {
    const room = await readyRoom();
    const { matchId } = await game.startPrivateRoom(ALICE, room.room.id);

    await vi.waitFor(() =>
      expect(publisher.publishMatchStarted).toHaveBeenCalled(),
    );
    expect(publisher.publishMatchStarted).toHaveBeenCalledWith({
      matchId,
      mode: '1v1',
      roomCode: room.room.code,
      participants: expect.arrayContaining([
        { userId: ALICE, sideId: 'left' },
        { userId: BOB, sideId: 'right' },
      ]),
    });
    const started = published.find(
      (event) => event.type === 'game.match.started',
    );
    expect(started?.data).toMatchObject({ matchId, roomCode: room.room.code });
  });

  it('announces a forfeit when a player leaves the match', async () => {
    const room = await readyRoom();
    const { matchId } = await game.startPrivateRoom(ALICE, room.room.id);

    await game.leave(BOB, matchId);

    await vi.waitFor(() =>
      expect(publisher.publishMatchEnded).toHaveBeenCalled(),
    );
    expect(publisher.publishMatchEnded).toHaveBeenCalledWith({
      matchId,
      mode: '1v1',
      participants: expect.arrayContaining([
        expect.objectContaining({
          userId: ALICE,
          sideId: 'left',
          outcome: 'win',
        }),
        expect.objectContaining({
          userId: BOB,
          sideId: 'right',
          outcome: 'loss',
        }),
      ]),
      forfeit: { winnerSideId: 'left', loserSideId: 'right', reason: 'leave' },
      endedBecause: 'forfeit',
    });
  });

  it('announces a withdrawn challenge when the owner closes the room', async () => {
    const room = await readyRoom();

    const result = await game.leavePrivateRoom(ALICE, room.room.id);

    expect(result.closed).toBe(true);
    await vi.waitFor(() =>
      expect(publisher.publishChallengeCancelled).toHaveBeenCalled(),
    );
    expect(publisher.publishChallengeCancelled).toHaveBeenCalledWith({
      roomCode: room.room.code,
      reason: 'room-closed',
      participantUserIds: expect.arrayContaining([ALICE, BOB]),
    });
  });

  it('announces an expired challenge once', async () => {
    const room = await game.createPrivateRoom(ALICE, '1v1');
    now += 21 * 60 * 1000;
    vi.mocked(Date.now).mockReturnValue(now);

    await game.sweepExpiredChallenges();
    await game.sweepExpiredChallenges();

    await vi.waitFor(() =>
      expect(publisher.publishChallengeCancelled).toHaveBeenCalledTimes(1),
    );
    expect(publisher.publishChallengeCancelled).toHaveBeenCalledWith({
      roomCode: room.room.code,
      reason: 'expired',
      participantUserIds: [ALICE],
    });
  });

  it('retries an expiry notification the broker did not confirm', async () => {
    const room = await game.createPrivateRoom(ALICE, '1v1');
    now += 21 * 60 * 1000;
    vi.mocked(Date.now).mockReturnValue(now);
    // The first publication is not confirmed by the broker.
    publishChallengeCancelled.mockResolvedValueOnce(false);

    await game.sweepExpiredChallenges();
    expect(publishChallengeCancelled).toHaveBeenCalledTimes(1);

    // An unconfirmed challenge is not remembered, so the next sweep retries it.
    await game.sweepExpiredChallenges();
    expect(publishChallengeCancelled).toHaveBeenCalledTimes(2);
    expect(publishChallengeCancelled).toHaveBeenLastCalledWith({
      roomCode: room.room.code,
      reason: 'expired',
      participantUserIds: [ALICE],
    });
  });

  it('republishes a match result the broker did not confirm', async () => {
    const room = await readyRoom();
    const { matchId } = await game.startPrivateRoom(ALICE, room.room.id);
    // The first result publication is not confirmed by the broker.
    publishMatchEnded.mockResolvedValueOnce(false);

    await game.leave(BOB, matchId);

    await vi.waitFor(() => expect(publishMatchEnded).toHaveBeenCalledTimes(2), {
      timeout: 8000,
      interval: 100,
    });
    expect(publishMatchEnded).toHaveBeenLastCalledWith(
      expect.objectContaining({ matchId, endedBecause: 'forfeit' }),
    );
  });

  it('announces every expired challenge, not only the first page', async () => {
    const total = 201;
    for (let index = 0; index < total; index++) {
      await game.createPrivateRoom(`owner-${index}`, '1v1');
    }
    now += 21 * 60 * 1000;
    vi.mocked(Date.now).mockReturnValue(now);

    await game.sweepExpiredChallenges();

    expect(publisher.publishChallengeCancelled).toHaveBeenCalledTimes(total);
  });

  it('never publishes source code, editor state or hidden test data', async () => {
    const room = await readyRoom();
    const { matchId } = await game.startPrivateRoom(ALICE, room.room.id);
    await game.leave(BOB, matchId);

    await vi.waitFor(() =>
      expect(publisher.publishMatchEnded).toHaveBeenCalled(),
    );
    const serialized = JSON.stringify(published);
    expect(serialized).not.toMatch(/source|hidden|editor|submission/i);
    expect(serialized).toContain(matchId);
  });

  it('publishes a match start before its result', async () => {
    const room = await readyRoom();
    const { matchId } = await game.startPrivateRoom(ALICE, room.room.id);
    await game.leave(BOB, matchId);

    await vi.waitFor(() =>
      expect(published.map((event) => event.type)).toEqual([
        'game.match.started',
        'game.match.ended',
      ]),
    );
    expect(matchId).toBeTruthy();
  });
});
