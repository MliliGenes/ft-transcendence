import { LobbyClient } from '@/lib/arena/lobby';
import { chatApi } from '@/lib/chat/client';

const INVITE_PATTERN =
  /^🎮 Code Arena challenge\r?\n\r?\n\[Accept & Join\]\(\/play\/lobby\/([A-Z0-9]{6})\)$/u;

export function formatCodeArenaInvite(code: string): string {
  const normalizedCode = code.toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalizedCode))
    throw new Error('Invalid Code Arena lobby code.');
  return `🎮 Code Arena challenge\n\n[Accept & Join](/play/lobby/${normalizedCode})`;
}

export function parseCodeArenaInvite(content: string): { code: string } | null {
  const match = INVITE_PATTERN.exec(content);
  return match ? { code: match[1] } : null;
}

export async function createCodeArenaInvite(input: {
  userId: string;
  token: string;
  conversationId: string;
}): Promise<{ code: string }> {
  const lobby = new LobbyClient('', input.userId, input.token);
  const { room } = await lobby.createRoom('1v1');
  try {
    const content = formatCodeArenaInvite(room.code);
    // The room code travels with the message so the chat service can link
    // this conversation to the match and announce its lifecycle here.
    await chatApi.send(
      input.conversationId,
      content,
      globalThis.crypto.randomUUID(),
      input.token,
      [],
      { roomCode: room.code },
    );
    return { code: room.code };
  } catch (error) {
    await lobby.leaveRoom(room.id).catch(() => undefined);
    throw error;
  }
}
