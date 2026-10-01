import { useEffect, useState } from 'react';
import { api } from '../lib/runtime.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { ProfileImage } from './ProfileImage.jsx';
import { Loading, Notice } from './Notice.jsx';

export function Directory() {
  const { revision } = useAuth();
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .request(`/accounts?page=${page}&limit=6`, {
        auth: false,
        signal: controller.signal,
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.totalPages > 0 && page > result.totalPages)
          setPage(result.totalPages);
        else setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, retry, revision]);
  return (
    <aside className="card directory" aria-labelledby="directory-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Community</p>
          <h2 id="directory-heading">People here</h2>
        </div>
        {data && <span className="badge">{data.total}</span>}
      </div>
      {error ? (
        <>
          <Notice error={error} />
          <button
            className="button button-secondary"
            onClick={() => setRetry((n) => n + 1)}
          >
            Try again
          </button>
        </>
      ) : loading && !data ? (
        <Loading text="Loading people…" />
      ) : data?.users.length ? (
        <ul className="user-list" aria-busy={loading}>
          {data.users.map((user) => (
            <li key={user.id} className="user-row">
              <ProfileImage user={user} small revision={revision} />
              <div>
                <strong>{user.displayName || user.username}</strong>
                <span>@{user.username}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted empty-state">No profiles to show yet.</p>
      )}
      {data && data.totalPages > 1 && (
        <nav className="pagination" aria-label="People pages">
          <button
            className="button button-small button-secondary"
            disabled={loading || page === 1}
            onClick={() => setPage((n) => n - 1)}
          >
            Previous
          </button>
          <span>
            {page} / {data.totalPages}
          </span>
          <button
            className="button button-small button-secondary"
            disabled={loading || page >= data.totalPages}
            onClick={() => setPage((n) => n + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </aside>
  );
}
