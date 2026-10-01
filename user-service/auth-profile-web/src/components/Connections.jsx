import { useState } from 'react';
import { api } from '../lib/runtime.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { Notice } from './Notice.jsx';

export function Connections() {
  const { mutating } = useAuth();
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
          <p className="muted">Connect your Discord account to this profile.</p>
        </div>
        <button
          className="button button-secondary"
          disabled={busy || mutating}
          onClick={connect}
        >
          {busy ? 'Opening Discord…' : 'Connect Discord'}
        </button>
      </div>
      <p className="field-hint">
        Already connected? Authorizing the same Discord account again keeps your
        existing connection.
      </p>
      <Notice error={error} />
    </section>
  );
}
