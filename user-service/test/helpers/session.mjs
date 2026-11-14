import assert from 'node:assert/strict';

// Refresh credentials are private HttpOnly cookies, never JSON response fields.
export function readSession(response) {
  assert.equal(response.body.refreshToken, undefined);
  assert.equal(response.body.refreshExpiresIn, undefined);
  const cookie = response.headers['set-cookie']?.find((value) =>
    value.startsWith('auth-refresh='),
  );
  assert.ok(cookie, 'session must set the refresh cookie');
  assert.match(cookie, /; HttpOnly/i);
  assert.match(cookie, /; SameSite=Lax/i);
  assert.match(cookie, /; Path=\/auth\//i);
  const refreshToken = cookie.split(';', 1)[0].slice('auth-refresh='.length);
  const refreshExpiresIn = Number(cookie.match(/; Max-Age=(\d+)/i)?.[1]);
  return { ...response.body, refreshToken, refreshExpiresIn };
}
