import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RoomLookupResponse = {
  ok?: boolean;
  status?: string;
  room?: { id?: string; code?: string } | null;
};

/**
 * The Game service answers a room read with `{ ok: true, ...roomWithMembers }`,
 * so the room record (and its owner) sits under `room`.
 */
type RoomResponse = {
  ok?: boolean;
  room?: { id?: string; code?: string; ownerUserId?: string } | null;
  members?: Array<{ userId: string }>;
};

/**
 * Reads Code Arena rooms from the Game service.
 *
 * The Game service owns rooms and their membership. Chat only forwards the
 * caller's own access token and reads the answer, so the decision "may this
 * account announce this room in a conversation?" is made by the service that
 * owns the room, never by the browser and never by Chat.
 */
@Injectable()
export class GameRoomsClient {
  private readonly logger = new Logger(GameRoomsClient.name);
  private readonly baseUrl: URL | null;

  constructor(config: ConfigService) {
    const configured = config.get<string>('GAME_SERVICE_URL')?.trim();
    this.baseUrl = configured ? new URL(configured) : null;
  }

  /**
   * True when the authenticated caller may announce the private room with this
   * invite code in a conversation.
   *
   * The Game service owns rooms and their membership: it refuses a non-member
   * with 403, so the first question is answered there. The second question,
   * "may this account announce this room?", is answered by the room record
   * the Game service returns: only the account that created the room may
   * publish its invite code, because only that account created the challenge.
   * Throws when the Game service cannot answer, so a failure is never treated
   * as a permission.
   */
  async canAnnounce(
    roomCode: string,
    userId: string,
    authorization: string,
  ): Promise<boolean> {
    if (!this.baseUrl) {
      throw new ServiceUnavailableException(
        'The game service is not configured',
      );
    }
    const lookup = await this.request<RoomLookupResponse>(
      `/lobby/rooms/lookup/${encodeURIComponent(roomCode)}`,
      authorization,
    );
    const roomId = lookup?.room?.id;
    if (!roomId) return false;
    // The Game service refuses a non-member with 403 and an unknown room with
    // 404; both mean the caller may not announce this room.
    const room = await this.request<RoomResponse>(
      `/lobby/rooms/${encodeURIComponent(roomId)}`,
      authorization,
    );
    if (!room) return false;
    return room.room?.ownerUserId === userId;
  }

  private async request<T>(
    path: string,
    authorization: string,
  ): Promise<T | null> {
    let response: Response;
    try {
      response = await fetch(new URL(path, this.baseUrl!), {
        headers: { authorization, accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      this.logger.warn(`The game service did not answer ${path}`);
      throw new ServiceUnavailableException('The game service is unavailable');
    }
    if (response.status === 403 || response.status === 404) return null;
    if (!response.ok) {
      this.logger.warn(
        `The game service answered ${path} with ${response.status}`,
      );
      throw new ServiceUnavailableException('The game service is unavailable');
    }
    return (await response.json().catch(() => null)) as T;
  }
}
