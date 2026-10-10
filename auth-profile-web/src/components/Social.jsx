import { useEffect, useState } from 'react';
import { api } from '../lib/runtime.js';
import { Notice } from './Notice.jsx';

const lists = [
  { path: 'friendships', title: 'Friends' },
  { path: 'friendships/requests', title: 'Incoming requests' },
  { path: 'friendships/sent', title: 'Sent requests' },
  { path: 'blocks', title: 'Blocked users' },
];

export function Social() {
  const [targetId, setTargetId] = useState('');
  const [friendshipId, setFriendshipId] = useState('');
  const [results, setResults] = useState([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    Promise.allSettled(lists.map(({ path }) =>
      api.request(`/social/${path}`, { signal: controller.signal }),
    )).then((data) => {
      if (controller.signal.aborted) return;
      setResults(data);
      setLoading(false);
    });
    return () => controller.abort();
  }, [revision]);

  async function act(method, path) {
    if (busy || loading) return;
    setBusy(true);
    setError(null);
    setResponse(null);
    try {
      const data = await api.request(`/social/${path}`, { method });
      setResponse({ endpoint: `${method} /social/${path}`, data });
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || loading;
  return (
    <section className="card settings-card social" aria-labelledby="social-heading" aria-busy={disabled}>
      <div className="section-heading">
        <div>
          <h2 id="social-heading">Friends &amp; blocks</h2>
          <p className="muted">Test social endpoints with another account. Copy its user ID from People here.</p>
        </div>
        <button className="button button-secondary button-small" disabled={disabled} onClick={() => setRevision((value) => value + 1)}>
          {loading ? 'Loading...' : 'Refresh lists'}
        </button>
      </div>
      <form onSubmit={(event) => {
        event.preventDefault();
        void act('POST', `friendships/${encodeURIComponent(targetId.trim())}`);
      }}>
        <fieldset disabled={disabled}>
          <label>
            Target user ID
            <input required value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="User UUID" />
          </label>
          <div className="form-actions">
            <button className="button button-primary" disabled={!targetId.trim()}>Send friend request</button>
            <button type="button" className="button button-secondary" disabled={!targetId.trim()} onClick={() => act('POST', `blocks/${encodeURIComponent(targetId.trim())}`)}>Block user</button>
            <button type="button" className="button button-secondary" disabled={!targetId.trim()} onClick={() => act('DELETE', `blocks/${encodeURIComponent(targetId.trim())}`)}>Unblock user</button>
          </div>
        </fieldset>
      </form>
      <p className="field-hint">Blocking also removes friendships and requests between the two accounts.</p>
      <Notice error={error} />
      {response && (
        <div role="status">
          <p className="field-hint">Succeeded: {response.endpoint}</p>
          <details>
            <summary>Response JSON (includes friendship ID)</summary>
            <pre>{JSON.stringify(response.data, null, 2)}</pre>
          </details>
        </div>
      )}
      {lists.map(({ path, title }, index) => {
        const result = results[index];
        const items = result?.status === 'fulfilled' ? result.value : [];
        return (
          <section key={path} className="social-list" aria-label={title}>
            <h3>{title}{result?.status === 'fulfilled' ? ` (${items.length})` : ''}</h3>
            <p className="field-hint">GET /social/{path}</p>
            {loading ? <p className="muted">Loading...</p> : result?.status === 'rejected' ? <Notice error={result.reason} /> : items.length === 0 ? (
              <p className="muted">No {title.toLowerCase()}.</p>
            ) : (
              <ul className="social-users">
                {items.map((item) => {
                  const user = path === 'friendships/requests' ? item.requester : path === 'friendships/sent' ? item.addressee : item;
                  return (
                    <li key={item.id}>
                      <strong>{user.displayName || user.username}</strong> <span className="muted">@{user.username}</span>
                      <p className="field-hint">User ID: <code>{user.id}</code></p>
                      {item.status && <p className="field-hint">{item.status} · Friendship ID: <code>{item.id}</code></p>}
                      <div className="form-actions">
                        {path === 'friendships/requests' && <>
                          <button className="button button-small button-primary" disabled={disabled} onClick={() => act('PATCH', `friendships/${item.id}/accept`)}>Accept</button>
                          <button className="button button-small button-secondary" disabled={disabled} onClick={() => act('PATCH', `friendships/${item.id}/reject`)}>Reject</button>
                        </>}
                        {path === 'friendships/sent' && <button className="button button-small button-secondary" disabled={disabled} onClick={() => act('DELETE', `friendships/${item.id}`)}>Cancel request</button>}
                        <button className="button button-small button-secondary" disabled={disabled} onClick={() => act(path === 'blocks' ? 'DELETE' : 'POST', `blocks/${user.id}`)}>
                          {path === 'blocks' ? 'Unblock' : 'Block'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      <form onSubmit={(event) => {
        event.preventDefault();
        void act('DELETE', `friendships/${encodeURIComponent(friendshipId.trim())}`);
      }}>
        <fieldset disabled={disabled}>
          <label>
            Friendship ID to delete
            <input required value={friendshipId} onChange={(event) => setFriendshipId(event.target.value)} placeholder="Friendship UUID" />
          </label>
          <p className="field-hint">The friends endpoint only returns users. Use the friendship ID from a request or action response to remove an accepted or declined friendship.</p>
          <button className="button button-secondary" disabled={!friendshipId.trim()}>Delete friendship</button>
        </fieldset>
      </form>
    </section>
  );
}
