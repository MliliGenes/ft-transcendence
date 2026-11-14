import { describe, expect, it, vi } from 'vitest';
import { GameNotificationsService } from '../src/chat/game-notifications.service.js';
import { parseGameEvent, GAME_EVENT_TYPES } from '../src/events/game-event.js';
import { SYSTEM_AUTHOR_ID } from '../src/chat/system-author.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { ChatGateway } from '../src/chat/gateway/chat.gateway.js';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const CONVERSATION = '44444444-4444-4444-8444-444444444444';
const ROOM = 'AB12CD';

type FakeChallenge = {
  roomCode: string;
  conversationId: string;
  matchId: string | null;
};
type FakeMessage = {
  id: string;
  conversationId: string;
  authorId: string;
  content: string | null;
  kind: string;
  clientRequestId: string;
};

function fakePrisma() {
  const challenges = new Map<string, FakeChallenge>();
  const users = new Map<
    string,
    { id: string; username: string | null; displayName: string | null }
  >([
    [ALICE, { id: ALICE, username: 'alice', displayName: null }],
    [BOB, { id: BOB, username: 'bob', displayName: 'Bob B' }],
  ]);
  const messages: FakeMessage[] = [];
  const conversations = new Map<
    string,
    {
      id: string;
      kind: 'DM' | 'CHANNEL';
      dmUserAId: string | null;
      dmUserBId: string | null;
      members: string[];
    }
  >([
    [
      CONVERSATION,
      {
        id: CONVERSATION,
        kind: 'DM',
        dmUserAId: ALICE,
        dmUserBId: BOB,
        members: [ALICE, BOB],
      },
    ],
  ]);
  let sequence = 0;

  const prisma = {
    gameChallenge: {
      findUnique: vi.fn(async ({ where }: { where: { roomCode: string } }) => {
        const found = challenges.get(where.roomCode);
        return found ? { ...found } : null;
      }),
      findFirst: vi.fn(async ({ where }: { where: { matchId: string } }) => {
        for (const challenge of challenges.values()) {
          if (challenge.matchId === where.matchId) return { ...challenge };
        }
        return null;
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { roomCode: string };
          data: { matchId: string };
        }) => {
          const challenge = challenges.get(where.roomCode);
          if (!challenge) throw new Error('challenge not found');
          challenge.matchId = data.matchId;
          return { ...challenge };
        },
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { roomCode: string };
          create: FakeChallenge;
        }) => {
          const existing = challenges.get(where.roomCode);
          if (existing) return { ...existing };
          challenges.set(create.roomCode, { ...create });
          return { ...create };
        },
      ),
    },
    conversation: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
        const conversation = conversations.get(where.id);
        if (!conversation) return null;
        return {
          kind: conversation.kind,
          dmUserAId: conversation.dmUserAId,
          dmUserBId: conversation.dmUserBId,
          group:
            conversation.kind === 'CHANNEL'
              ? { members: conversation.members.map((userId) => ({ userId })) }
              : null,
        };
      }),
    },
    chatUser: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in
          .filter((id) => users.has(id))
          .map((id) => ({ ...users.get(id)! })),
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { id: string };
          create: { id: string; username: string; displayName: string };
        }) => {
          if (!users.has(where.id)) {
            users.set(where.id, {
              id: where.id,
              username: create.username,
              displayName: create.displayName,
            });
          }
          return { ...users.get(where.id)! };
        },
      ),
    },
    message: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { authorId: string; clientRequestId: string };
        }) => {
          const found = messages.find(
            (message) =>
              message.authorId === where.authorId &&
              message.clientRequestId === where.clientRequestId,
          );
          return found ? { ...found } : null;
        },
      ),
      create: vi.fn(async ({ data }: { data: FakeMessage }) => {
        const duplicate = messages.find(
          (message) =>
            message.authorId === data.authorId &&
            message.clientRequestId === data.clientRequestId,
        );
        if (duplicate) {
          const error = new Error('unique constraint') as Error & {
            code: string;
          };
          error.code = 'P2002';
          throw error;
        }
        const created: FakeMessage = { ...data, id: `message-${++sequence}` };
        messages.push(created);
        return {
          ...created,
          author: {
            id: SYSTEM_AUTHOR_ID,
            username: 'code-arena',
            displayName: 'Code Arena',
            avatarUrl: null,
          },
        };
      }),
    },
  };

  return { prisma, challenges, messages, conversations };
}

/** The challenge binding the Chat service writes with the invitation. */
async function linkChallenge(
  fake: ReturnType<typeof fakePrisma>,
  roomCode: string,
  conversationId: string,
) {
  await fake.prisma.gameChallenge.upsert({
    where: { roomCode },
    create: { roomCode, conversationId },
    update: {},
  });
}

function build() {
  const fake = fakePrisma();
  const gateway = {
    broadcastMessageCreated: vi.fn(),
  } as unknown as ChatGateway;
  const service = new GameNotificationsService(
    fake.prisma as unknown as PrismaService,
    gateway,
  );
  return { ...fake, gateway, service };
}

const matchStarted = {
  eventId: '9f8b1c2d-1111-4111-8111-111111111111',
  eventType: GAME_EVENT_TYPES.MATCH_STARTED,
  occurredAt: '2026-11-11T10:00:00.000Z',
  data: {
    matchId: 'match-1',
    mode: '1v1' as const,
    roomCode: ROOM,
    participants: [
      { userId: ALICE, sideId: 'left' },
      { userId: BOB, sideId: 'right' },
    ],
  },
};

const matchEnded = {
  eventId: '9f8b1c2d-2222-4222-8222-222222222222',
  eventType: GAME_EVENT_TYPES.MATCH_ENDED,
  occurredAt: '2026-11-11T10:30:00.000Z',
  data: {
    matchId: 'match-1',
    mode: '1v1' as const,
    participants: [
      { userId: ALICE, sideId: 'left', outcome: 'win' as const, score: 300 },
      { userId: BOB, sideId: 'right', outcome: 'loss' as const, score: 225 },
    ],
    forfeit: null,
    endedBecause: 'completed' as const,
  },
};

describe('Game event contract', () => {
  it('accepts a well-formed lifecycle event', () => {
    const parsed = parseGameEvent(matchStarted);
    expect(parsed?.eventType).toBe(GAME_EVENT_TYPES.MATCH_STARTED);
  });

  it('rejects malformed or forged payloads', () => {
    expect(parseGameEvent(null)).toBeNull();
    expect(
      parseGameEvent({ ...matchStarted, eventId: 'not-a-uuid' }),
    ).toBeNull();
    expect(
      parseGameEvent({
        ...matchStarted,
        data: { ...matchStarted.data, roomCode: 'toolong' },
      }),
    ).toBeNull();
    expect(
      parseGameEvent({
        ...matchStarted,
        data: { ...matchStarted.data, mode: '3v3' },
      }),
    ).toBeNull();
    expect(
      parseGameEvent({ ...matchStarted, eventType: 'game.match.won' }),
    ).toBeNull();
    expect(
      parseGameEvent({
        ...matchEnded,
        data: { ...matchEnded.data, participants: [] },
      }),
    ).toBeNull();
    expect(
      parseGameEvent({
        ...matchEnded,
        data: {
          ...matchEnded.data,
          participants: [
            { userId: ALICE, sideId: 'left', outcome: 'winner', score: 1 },
          ],
        },
      }),
    ).toBeNull();
  });
});

describe('GameNotificationsService', () => {
  it('announces a started match in the linked conversation and delivers it live', async () => {
    const { service, gateway, messages, ...fake } = build();
    await linkChallenge(fake, ROOM, CONVERSATION);

    const outcome = await service.applyGameEvent(matchStarted);

    expect(outcome.delivered).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      conversationId: CONVERSATION,
      authorId: SYSTEM_AUTHOR_ID,
      kind: 'SYSTEM',
    });
    expect(messages[0]!.content).toContain('match-started');
    expect(messages[0]!.content).toContain('alice');
    expect(messages[0]!.content).toContain('Bob B');
    expect(gateway.broadcastMessageCreated).toHaveBeenCalledWith(
      [ALICE, BOB],
      expect.objectContaining({ id: messages[0]!.id }),
    );
  });

  it('does not repeat a notification when the same event is delivered twice', async () => {
    const { service, gateway, messages, ...fake } = build();
    await linkChallenge(fake, ROOM, CONVERSATION);

    await service.applyGameEvent(matchStarted);
    const second = await service.applyGameEvent(matchStarted);

    expect(second.delivered).toBe(true);
    expect(second.reason).toBe('already delivered');
    expect(messages).toHaveLength(1);
    expect(gateway.broadcastMessageCreated).toHaveBeenCalledTimes(1);
  });

  it('ignores a match that no challenge links to a conversation', async () => {
    const { service, messages } = build();
    const outcome = await service.applyGameEvent(matchStarted);
    expect(outcome.delivered).toBe(false);
    expect(messages).toHaveLength(0);
  });

  it('rejects an event whose participants are not members of the conversation', async () => {
    const { service, messages, ...fake } = build();
    await linkChallenge(fake, ROOM, CONVERSATION);

    const outcome = await service.applyGameEvent({
      ...matchStarted,
      data: {
        ...matchStarted.data,
        participants: [
          { userId: ALICE, sideId: 'left' },
          { userId: STRANGER, sideId: 'right' },
        ],
      },
    });

    expect(outcome.delivered).toBe(false);
    expect(outcome.reason).toMatch(/not conversation members/);
    expect(messages).toHaveLength(0);
  });

  it('announces the match result with the public score', async () => {
    const { service, messages, ...fake } = build();
    await linkChallenge(fake, ROOM, CONVERSATION);
    await service.applyGameEvent(matchStarted);

    const outcome = await service.applyGameEvent(matchEnded);

    expect(outcome.delivered).toBe(true);
    expect(messages).toHaveLength(2);
    expect(messages[1]!.content).toContain('match-result');
    expect(messages[1]!.content).toContain('alice');
    expect(messages[1]!.content).toContain('300');
    expect(messages[1]!.content).toContain('225');
    expect(messages[1]!.content).toContain('/play/match/match-1');
  });

  it('announces a forfeit without inventing a score', async () => {
    const { service, messages, ...fake } = build();
    await linkChallenge(fake, ROOM, CONVERSATION);
    await service.applyGameEvent(matchStarted);

    await service.applyGameEvent({
      ...matchEnded,
      eventId: '9f8b1c2d-3333-4333-8333-333333333333',
      data: {
        ...matchEnded.data,
        participants: [
          { userId: ALICE, sideId: 'left', outcome: 'win', score: 0 },
          { userId: BOB, sideId: 'right', outcome: 'loss', score: 0 },
        ],
        forfeit: {
          winnerSideId: 'left',
          loserSideId: 'right',
          reason: 'leave',
        },
        endedBecause: 'forfeit',
      },
    });

    expect(messages).toHaveLength(2);
    expect(messages[1]!.content).toContain('forfeit');
    expect(messages[1]!.content).toContain('left the match');
  });

  it('announces unanimous surrender as a surrender, not an ordinary leave', async () => {
    const { service, messages, ...fake } = build();
    await linkChallenge(fake, ROOM, CONVERSATION);
    await service.applyGameEvent(matchStarted);

    const surrenderEvent = {
      ...matchEnded,
      eventId: '9f8b1c2d-6666-4666-8666-666666666666',
      data: {
        ...matchEnded.data,
        participants: [
          { userId: ALICE, sideId: 'left', outcome: 'win', score: 0 },
          { userId: BOB, sideId: 'right', outcome: 'loss', score: 0 },
        ],
        forfeit: {
          winnerSideId: 'left',
          loserSideId: 'right',
          reason: 'surrender',
        },
        endedBecause: 'forfeit',
      },
    };
    expect(parseGameEvent(surrenderEvent)).toMatchObject({
      data: { forfeit: { reason: 'surrender' } },
    });
    const outcome = await service.applyGameEvent(surrenderEvent as never);

    expect(outcome.delivered).toBe(true);
    expect(messages).toHaveLength(2);
    expect(messages[1]!.content).toContain('surrendered');
  });

  it('announces a draw with both public totals', async () => {
    const { service, messages, ...fake } = build();
    await linkChallenge(fake, ROOM, CONVERSATION);
    await service.applyGameEvent(matchStarted);

    await service.applyGameEvent({
      ...matchEnded,
      eventId: '9f8b1c2d-5555-4555-8555-555555555555',
      data: {
        ...matchEnded.data,
        participants: [
          { userId: ALICE, sideId: 'left', outcome: 'draw', score: 250 },
          { userId: BOB, sideId: 'right', outcome: 'draw', score: 250 },
        ],
      },
    });

    expect(messages).toHaveLength(2);
    expect(messages[1]!.content).toContain('Draw 250 – 250');
    expect(messages[1]!.content).not.toContain('Draw 0 –');
  });

  it('announces a cancelled challenge', async () => {
    const { service, messages, ...fake } = build();
    await linkChallenge(fake, ROOM, CONVERSATION);

    const outcome = await service.applyGameEvent({
      eventId: '9f8b1c2d-4444-4444-8444-444444444444',
      eventType: GAME_EVENT_TYPES.CHALLENGE_CANCELLED,
      occurredAt: '2026-11-11T10:40:00.000Z',
      data: {
        roomCode: ROOM,
        reason: 'expired',
        participantUserIds: [ALICE, BOB],
      },
    });

    expect(outcome.delivered).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toContain('challenge-cancelled');
    expect(messages[0]!.content).toContain('expired');
  });

  it('never leaks source code, editor state or hidden test data', async () => {
    const { service, messages, ...fake } = build();
    await linkChallenge(fake, ROOM, CONVERSATION);
    await service.applyGameEvent(matchStarted);
    await service.applyGameEvent(matchEnded);

    for (const message of messages) {
      expect(message.content).not.toMatch(
        /source|hidden|editor|submission|problemVersion/i,
      );
    }
  });
});
