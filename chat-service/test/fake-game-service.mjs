import { createServer } from 'node:http';

/**
 * A small stand-in for the Game service's room endpoints.
 *
 * It answers exactly what `services/game/src/game/lobby.controller.ts`
 * answers: the invite-code lookup, and the room read that the Game service
 * refuses for a non-member. The caller's identity comes from the access token
 * the Chat service forwards, which is how the real service authenticates.
 */
export async function startFakeGameService(rooms = []) {
  const state = new Map(rooms.map((room) => [room.code, room]));

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const caller = callerFrom(req.headers.authorization);
    const json = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    const lookup = /^\/lobby\/rooms\/lookup\/([A-Za-z0-9]{1,32})$/.exec(url.pathname);
    if (lookup) {
      const room = state.get(lookup[1].toUpperCase());
      if (!room) return json(200, { ok: true, status: 'expired', room: null, members: [] });
      return json(200, {
        ok: true,
        status: 'open',
        room: { id: room.id, code: room.code },
        members: room.members.map((userId) => ({ userId })),
      });
    }

    const byId = /^\/lobby\/rooms\/([^/]+)$/.exec(url.pathname);
    if (byId) {
      const room = [...state.values()].find((entry) => entry.id === byId[1]);
      if (!room) return json(404, { error: 'room not found' });
      if (!room.members.includes(caller)) {
        return json(403, { error: 'not a member of this room' });
      }
      return json(200, {
        ok: true,
        id: room.id,
        code: room.code,
        ownerUserId: room.ownerUserId ?? room.members[0],
        members: room.members.map((userId) => ({ userId })),
      });
    }

    return json(404, { error: 'unknown route' });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    rooms: state,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function callerFrom(header) {
  const token = String(header ?? '').replace(/^Bearer\s+/i, '');
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).sub ?? null;
  } catch {
    return null;
  }
}
