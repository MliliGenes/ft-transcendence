import { io } from 'socket.io-client';
import { ApiError } from './api-client.js';
import { api, sessionStore } from './runtime.js';

const configured = import.meta.env.VITE_CHAT_URL?.trim();
export const CHAT_URL = new URL(
  configured || window.location.origin,
  window.location.origin,
)
  .toString()
  .replace(/\/$/, '');

async function send(path, options, accessToken) {
  const response = await fetch(`${CHAT_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options.json === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
    body: options.json === undefined ? undefined : JSON.stringify(options.json),
    signal: options.signal,
  });
  const payload =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const messages = (
      Array.isArray(payload?.message) ? payload.message : [payload?.message]
    ).filter((message) => typeof message === 'string');
    throw new ApiError(
      messages[0] || `Chat request failed (${response.status}).`,
      response.status,
      messages,
    );
  }
  return payload;
}

export async function chatRequest(path, options = {}) {
  let session = sessionStore.read();
  if (!session) throw new ApiError('Please sign in to use chat.', 401);

  try {
    return await send(path, options, session.accessToken);
  } catch (error) {
    if (error.status !== 401 || options.signal?.aborted) throw error;
    await api.restoreSession(true);
    session = sessionStore.read();
    if (!session) throw error;
    return send(path, options, session.accessToken);
  }
}

export function connectChatSocket(accessToken) {
  const namespace = new URL('/chat', `${CHAT_URL}/`).toString();
  return io(namespace, {
    path: '/socket.io',
    auth: { token: accessToken },
  });
}
