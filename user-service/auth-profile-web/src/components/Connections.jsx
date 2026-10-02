import { useState } from 'react';
import { api } from '../lib/runtime.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { Notice } from './Notice.jsx';

export function Connections() {
  const { profile, mutating, unlinkDiscord, unlinkGithub } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function connect() {
    if (busy || mutating) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.request('/auth/discord/link', {
        method: 'POST',
        credentials: 'include',
      });
      const url = new URL(result.authorizationUrl);
      if (
        url.origin !== 'https://discord.com' ||
        url.pathname !== '/oauth2/authorize'
      )
        throw new Error(
          'The connection could not be started. Please try again.',
        );
      window.location.assign(url.toString());
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }
  async function disconnect() {
    if (busy || mutating) return;
    setBusy(true);
    setError(null);
    try {
      await unlinkDiscord();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function disconnectGithub() {
    if (busy || mutating) return;
    setBusy(true);
    setError(null);
    try {
      await unlinkGithub();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="card settings-card"
      aria-labelledby="connections-heading"
    >
      <div className="section-heading">
        <div>
          <h2 id="connections-heading">Connected accounts</h2>
          <p className="muted">Add another way to sign in.</p>
        </div>
      </div>
      <div className="connection-row">
        <span className="provider-icon" aria-hidden="true">
          D
        </span>
        <div>
          <h3>Discord</h3>
          <p className="muted">
            {profile.hasDiscord
              ? 'Discord is connected to this profile.'
              : 'Connect your Discord account to this profile.'}
          </p>
        </div>
        {profile.hasDiscord ? (
          <button
            className="button button-secondary"
            disabled={busy || mutating || !profile.hasPassword}
            onClick={disconnect}
            title={
              !profile.hasPassword
                ? 'Set a password before disconnecting your only sign-in method.'
                : undefined
            }
          >
            {busy ? 'Removing Discord…' : 'Disconnect Discord'}
          </button>
        ) : (
          <button
            className="button button-secondary"
            disabled={busy || mutating}
            onClick={connect}
          >
            {busy ? 'Opening Discord…' : 'Connect Discord'}
          </button>
        )}
      </div>
      <div className="connection-row">
        <span className="provider-icon" aria-hidden="true">
          G
        </span>
        <div>
          <h3>GitHub</h3>
          <p className="muted">
            {profile.hasGithub
              ? 'GitHub is connected to this profile.'
              : 'Connect your GitHub account to this profile.'}
          </p>
        </div>
        {profile.hasGithub ? (
          <button
            className="button button-secondary"
            disabled={busy || mutating || !profile.hasPassword}
            onClick={disconnectGithub}
            title={
              !profile.hasPassword
                ? 'Set a password before disconnecting your only sign-in method.'
                : undefined
            }
          >
            {busy ? 'Removing GitHub…' : 'Disconnect GitHub'}
          </button>
        ) : (
          <button
            className="button button-secondary"
            disabled={busy || mutating}
            onClick={async () => {
              if (busy || mutating) return;
              setBusy(true);
              setError(null);
              try {
                const result = await api.request('/auth/github/link', {
                  method: 'POST',
                  credentials: 'include',
                });
                const url = new URL(result.authorizationUrl);
                if (
                  url.origin !== 'https://github.com' ||
                  url.pathname !== '/login/oauth/authorize'
                )
                  throw new Error(
                    'The connection could not be started. Please try again.',
                  );
                window.location.assign(url.toString());
              } catch (e) {
                setError(e);
                setBusy(false);
              }
            }}
          >
            {busy ? 'Opening GitHub…' : 'Connect GitHub'}
          </button>
        )}
      </div>
      <p className="field-hint">
        {profile.hasDiscord && !profile.hasPassword
          ? 'Set a password before disconnecting Discord because it is currently your only sign-in method.'
          : 'Authorizing the same Discord account again keeps your existing connection.'}
      </p>
      <Notice error={error} />
    </section>
  );
}
