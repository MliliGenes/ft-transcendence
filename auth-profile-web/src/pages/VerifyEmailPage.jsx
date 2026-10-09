import { useEffect, useState } from 'react';
import { Notice, Loading } from '../components/Notice.jsx';
import { api } from '../lib/runtime.js';
import { navigate } from '../lib/navigation.js';

export function VerifyEmailPage() {
  const [state, setState] = useState({ status: 'loading', error: null });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState({
        status: 'error',
        error: new Error('This verification link is missing its token.'),
      });
      return;
    }

    let active = true;
    api
      .request(`/auth/verify-email/${encodeURIComponent(token)}`, {
        auth: false,
      })
      .then(() => {
        if (active) setState({ status: 'success', error: null });
      })
      .catch((error) => {
        if (active) setState({ status: 'error', error });
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="card settings-card" aria-labelledby="verify-heading">
      <h2 id="verify-heading">Email verification</h2>
      {state.status === 'loading' && <Loading text="Verifying your email…" />}
      {state.status === 'success' && (
        <>
          <Notice type="success">Your email has been verified.</Notice>
          <p className="muted">You can now sign in to your account.</p>
          <button
            className="button button-primary"
            onClick={() => navigate('/login')}
          >
            Go to login
          </button>
        </>
      )}
      {state.status === 'error' && (
        <>
          <Notice error={state.error} />
          <p className="muted">
            The link may have expired or already been used.
          </p>
          <button
            className="button button-primary"
            onClick={() => navigate('/login')}
          >
            Go to login
          </button>
        </>
      )}
    </section>
  );
}
