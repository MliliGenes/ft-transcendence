import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { ChatGateway } from './gateway/chat.gateway.js';
import {
  GAME_NOTIFICATION_TYPES,
  formatGameNotification,
  type GameNotificationType,
} from './game-notification-format.js';
import {
  SYSTEM_AUTHOR_DISPLAY_NAME,
  SYSTEM_AUTHOR_ID,
  SYSTEM_AUTHOR_USERNAME,
} from './system-author.js';
import {
  GAME_EVENT_TYPES,
  type GameEvent,
  type MatchEndedData,
  type MatchStartedData,
} from '../events/game-event.js';

const UNKNOWN_PLAYER = 'Unknown player';
const SYSTEM_AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

/**
 * Turns authoritative game lifecycle events into persisted chat messages.
 *
 * Every notification is written by the Chat service itself: the Game service
 * never touches the Chat database. Correlation between a game and a
 * conversation is established by the challenge invitation (room code ->
 * conversation) and is re-validated here before anything is written.
 */
@Injectable()
export class GameNotificationsService {
  private readonly logger = new Logger(GameNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ChatGateway,
  ) {}

  /**
   * Remember which conversation a Code Arena challenge belongs to. The first
   * invitation for a room code owns the link; later posts cannot move it.
   */
  async linkChallenge(conversationId: string, roomCode: string): Promise<void> {
    try {
      await this.prisma.gameChallenge.upsert({
        where: { roomCode },
        create: { roomCode, conversationId },
        update: {},
      });
    } catch (error) {
      // Two concurrent invitations for the same room code: the first one owns
      // the link, the second one is a no-op.
      if (!isUniqueViolation(error)) throw error;
    }
  }

  /**
   * Apply one lifecycle event. Returns what happened so the caller can log
   * rejected events without treating them as failures.
   */
  async applyGameEvent(
    event: GameEvent,
  ): Promise<{ delivered: boolean; reason: string }> {
    if (event.eventType === GAME_EVENT_TYPES.MATCH_STARTED) {
      return this.applyMatchStarted(event.data);
    }
    if (event.eventType === GAME_EVENT_TYPES.MATCH_ENDED) {
      return this.applyMatchEnded(event.data);
    }
    return this.applyChallengeCancelled(event.data);
  }

  private async applyMatchStarted(
    data: MatchStartedData,
  ): Promise<{ delivered: boolean; reason: string }> {
    if (!data.roomCode) {
      return { delivered: false, reason: 'no linked conversation' };
    }
    const link = await this.prisma.gameChallenge.findUnique({
      where: { roomCode: data.roomCode },
    });
    if (!link) {
      return { delivered: false, reason: 'challenge is not linked to a conversation' };
    }
    if (link.matchId && link.matchId !== data.matchId) {
      // A room code can only start one match; a different match id means the
      // event does not belong to the linked conversation.
      return { delivered: false, reason: 'challenge already started another match' };
    }

    const conversation = await this.conversationMembers(link.conversationId);
    if (!conversation) {
      return { delivered: false, reason: 'linked conversation no longer exists' };
    }
    const unexpected = data.participants.filter(
      (participant) => !conversation.memberIds.includes(participant.userId),
    );
    if (unexpected.length > 0) {
      this.logger.warn(
        `Rejected a match-start notification: ${unexpected.length} participant(s) are not members of the linked conversation`,
      );
      return { delivered: false, reason: 'participants are not conversation members' };
    }

    await this.prisma.gameChallenge.update({
      where: { roomCode: data.roomCode },
      data: { matchId: data.matchId },
    });

    const names = await this.playerNames(
      data.participants.map((participant) => participant.userId),
    );
    const summary = `${this.modeLabel(data.mode)} started: ${this.sideLabels(data.participants, names).join(' vs ')}`;
    return this.publish(link.conversationId, conversation.recipientIds, {
      type: GAME_NOTIFICATION_TYPES.MATCH_STARTED,
      summary,
      matchId: data.matchId,
      dedupeKey: `match-started:${data.matchId}`,
    });
  }

  private async applyMatchEnded(
    data: MatchEndedData,
  ): Promise<{ delivered: boolean; reason: string }> {
    const link = await this.prisma.gameChallenge.findFirst({
      where: { matchId: data.matchId },
    });
    if (!link) {
      return { delivered: false, reason: 'match is not linked to a conversation' };
    }

    const conversation = await this.conversationMembers(link.conversationId);
    if (!conversation) {
      return { delivered: false, reason: 'linked conversation no longer exists' };
    }
    const unexpected = data.participants.filter(
      (participant) => !conversation.memberIds.includes(participant.userId),
    );
    if (unexpected.length > 0) {
      this.logger.warn(
        'Rejected a match-result notification: participants are not members of the linked conversation',
      );
      return { delivered: false, reason: 'participants are not conversation members' };
    }

    const summary = await this.resultSummary(data);
    return this.publish(link.conversationId, conversation.recipientIds, {
      type: GAME_NOTIFICATION_TYPES.MATCH_RESULT,
      summary,
      matchId: data.matchId,
      dedupeKey: `match-result:${data.matchId}`,
    });
  }

  private async applyChallengeCancelled(data: {
    roomCode: string;
    reason: 'room-closed' | 'expired';
    participantUserIds: string[];
  }): Promise<{ delivered: boolean; reason: string }> {
    const link = await this.prisma.gameChallenge.findUnique({
      where: { roomCode: data.roomCode },
    });
    if (!link) {
      return { delivered: false, reason: 'challenge is not linked to a conversation' };
    }

    const conversation = await this.conversationMembers(link.conversationId);
    if (!conversation) {
      return { delivered: false, reason: 'linked conversation no longer exists' };
    }
    const unexpected = data.participantUserIds.filter(
      (userId) => !conversation.memberIds.includes(userId),
    );
    if (unexpected.length > 0) {
      this.logger.warn(
        'Rejected a challenge-cancellation notification: participants are not members of the linked conversation',
      );
      return { delivered: false, reason: 'participants are not conversation members' };
    }

    const summary =
      data.reason === 'expired'
        ? 'the duel challenge expired before it started'
        : 'the duel challenge was withdrawn before it started';
    return this.publish(link.conversationId, conversation.recipientIds, {
      type: GAME_NOTIFICATION_TYPES.CHALLENGE_CANCELLED,
      summary,
      matchId: null,
      dedupeKey: `challenge-cancelled:${data.roomCode}`,
    });
  }

  /**
   * Write the notification once. The deterministic request id makes a
   * redelivered or replayed event a no-op instead of a second message.
   */
  private async publish(
    conversationId: string,
    recipientIds: string[],
    notification: {
      type: GameNotificationType;
      summary: string;
      matchId: string | null;
      dedupeKey: string;
    },
  ): Promise<{ delivered: boolean; reason: string }> {
    const clientRequestId = deterministicUuid(conversationId, notification.dedupeKey);
    const content = formatGameNotification(
      notification.type,
      notification.summary,
      notification.matchId,
    );
    const requestHash = createHash('sha256')
      .update(JSON.stringify([conversationId, content]))
      .digest('hex');

    await this.ensureSystemAuthor();

    const existing = await this.prisma.message.findFirst({
      where: { authorId: SYSTEM_AUTHOR_ID, clientRequestId },
      include: { author: { select: SYSTEM_AUTHOR_SELECT } },
    });
    if (existing) {
      return { delivered: true, reason: 'already delivered' };
    }

    try {
      const created = await this.prisma.message.create({
        data: {
          conversationId,
          authorId: SYSTEM_AUTHOR_ID,
          content,
          clientRequestId,
          requestHash,
          kind: 'SYSTEM',
        },
        include: { author: { select: SYSTEM_AUTHOR_SELECT } },
      });
      this.gateway.broadcastMessageCreated(recipientIds, created);
      return { delivered: true, reason: 'delivered' };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Another delivery of the same event won the race.
      return { delivered: true, reason: 'already delivered' };
    }
  }

  private async ensureSystemAuthor(): Promise<void> {
    await this.prisma.chatUser.upsert({
      where: { id: SYSTEM_AUTHOR_ID },
      create: {
        id: SYSTEM_AUTHOR_ID,
        username: SYSTEM_AUTHOR_USERNAME,
        displayName: SYSTEM_AUTHOR_DISPLAY_NAME,
        sourceUpdatedAt: new Date(),
      },
      update: { displayName: SYSTEM_AUTHOR_DISPLAY_NAME },
    });
  }

  private async conversationMembers(
    conversationId: string,
  ): Promise<{ memberIds: string[]; recipientIds: string[] } | null> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId },
      select: {
        kind: true,
        dmUserAId: true,
        dmUserBId: true,
        group: { select: { members: { select: { userId: true } } } },
      },
    });
    if (!conversation) return null;
    const memberIds =
      conversation.kind === 'DM'
        ? [conversation.dmUserAId, conversation.dmUserBId].filter(
            (id): id is string => typeof id === 'string',
          )
        : (conversation.group?.members.map((member) => member.userId) ?? []);
    return { memberIds, recipientIds: memberIds };
  }

  private async playerNames(userIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(userIds)];
    const profiles = await this.prisma.chatUser.findMany({
      where: { id: { in: unique } },
      select: { id: true, username: true, displayName: true },
    });
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    return new Map(
      unique.map((id) => {
        const profile = byId.get(id);
        const name = profile?.displayName?.trim() || profile?.username?.trim();
        return [id, name || UNKNOWN_PLAYER] as const;
      }),
    );
  }

  private modeLabel(mode: '1v1' | '2v2'): string {
    return mode === '1v1' ? '1v1 duel' : '2v2 team duel';
  }

  /** One label per competitive side, in a stable order. */
  private sideLabels(
    participants: Array<{ userId: string; sideId: string }>,
    names: Map<string, string>,
  ): string[] {
    const bySide = new Map<string, string[]>();
    for (const participant of participants) {
      const list = bySide.get(participant.sideId) ?? [];
      list.push(names.get(participant.userId) ?? UNKNOWN_PLAYER);
      bySide.set(participant.sideId, list);
    }
    return [...bySide.keys()]
      .sort(
        (left, right) =>
          sideOrder(left) - sideOrder(right) || left.localeCompare(right),
      )
      .map((side) => (bySide.get(side) ?? []).join(' & '));
  }

  private async resultSummary(data: MatchEndedData): Promise<string> {
    const names = await this.playerNames(
      data.participants.map((participant) => participant.userId),
    );
    const sideLabels = this.sideLabels(data.participants, names);

    const sideTotals = new Map<string, number>();
    for (const participant of data.participants) {
      sideTotals.set(participant.sideId, participant.score);
    }
    const sides = [...sideTotals.keys()].sort(
      (left, right) => sideOrder(left) - sideOrder(right) || left.localeCompare(right),
    );
    const winnerSide =
      data.forfeit?.winnerSideId ??
      sides.find((side) =>
        data.participants.some(
          (participant) => participant.sideId === side && participant.outcome === 'win',
        ),
      );
    const winnerIndex = winnerSide ? sides.indexOf(winnerSide) : -1;
    const winnerLabel =
      winnerIndex >= 0 ? (sideLabels[winnerIndex] ?? UNKNOWN_PLAYER) : UNKNOWN_PLAYER;
    const loserIndex =
      winnerIndex >= 0 ? sides.findIndex((side) => side !== winnerSide) : -1;
    const loserLabel =
      loserIndex >= 0 ? (sideLabels[loserIndex] ?? UNKNOWN_PLAYER) : UNKNOWN_PLAYER;

    if (data.forfeit) {
      const cause =
        data.forfeit.reason === 'grace-expired'
          ? 'did not reconnect in time'
          : 'left the match';
      return `${winnerLabel} won by forfeit (${loserLabel} ${cause})`;
    }

    if (winnerIndex < 0) {
      // A draw: both sides count the same public total.
      const first = sides[0] ? (sideTotals.get(sides[0]) ?? 0) : 0;
      const second = sides[1] ? (sideTotals.get(sides[1]) ?? 0) : 0;
      return `Draw ${first} – ${second}`;
    }

    const winnerTotal = sideTotals.get(winnerSide!) ?? 0;
    const loserTotal = loserIndex >= 0 ? (sideTotals.get(sides[loserIndex]!) ?? 0) : 0;
    const deadline = data.endedBecause === 'deadline' ? ' (time limit reached)' : '';
    return `${winnerLabel} won ${winnerTotal} – ${loserTotal}${deadline}`;
  }
}

/**
 * A stable UUID for one logical notification. The same conversation and the
 * same event always produce the same id, so the unique index on
 * (authorId, clientRequestId) turns a replay into a no-op.
 */
export function deterministicUuid(...parts: string[]): string {
  const digest = createHash('sha256').update(parts.join(' ')).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/** Stable ordering for competitive sides: left first, then right. */
function sideOrder(sideId: string): number {
  if (sideId === 'left') return 0;
  if (sideId === 'right') return 1;
  return 2;
}
