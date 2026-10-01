import { useEffect } from 'react';
import { useAuth } from './auth/AuthProvider.jsx';
import { navigate, useRoute } from './lib/navigation.js';
import { AuthPage } from './pages/AuthPage.jsx';
import { AccountPage } from './pages/AccountPage.jsx';
import { Directory } from './components/Directory.jsx';
import { Loading, Notice } from './components/Notice.jsx';

export function App() {
  const path = useRoute();
  const {
    profile,
    status,
    loadError,
    notice,
    setNotice,
    signOut,
    restore,
    mutating,
  } = useAuth();
  const known = ['/', '/login', '/register', '/account'].includes(path);
  useEffect(() => {
    if (!known || status === 'loading' || status === 'error') return;
    if (status === 'authenticated' && path !== '/account')
      navigate('/account', { replace: true });
    if (status === 'anonymous' && (path === '/' || path === '/account'))
      navigate('/login', { replace: true });
  }, [path, status, known]);
  useEffect(() => {
    document.title = `${status === 'authenticated' ? 'Your profile' : path === '/register' ? 'Create account' : 'Log in'} · Fieldnote`;
  }, [path, status]);
  const authenticated = status === 'authenticated';
  return (
    <main className="shell" id="main-content">
      <a className="skip-link" href="#page-content">
        Skip to content
      </a>
      <header className="topbar">
        <a
          className="brand"
          href={authenticated ? '/account' : '/login'}
          onClick={(event) => {
            event.preventDefault();
            navigate(authenticated ? '/account' : '/login');
          }}
        >
          fieldnote<span>/</span>
          <span className="brand-section">account</span>
        </a>
        <div className="topbar-actions">
          {authenticated && (
            <>
              <span className="signed-in-as">@{profile.username}</span>
              <button
                className="button button-secondary button-small"
                onClick={signOut}
                disabled={mutating}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </header>
      <section className="intro">
        <p className="eyebrow">Your space</p>
        <h1>{authenticated ? 'Make it yours.' : 'A place to connect.'}</h1>
        <p className="lede">
          {authenticated
            ? 'Manage your profile, photos and the ways you sign in.'
            : 'Your account, your community. Start right here.'}
        </p>
      </section>
      <div id="page-content" tabIndex={-1}>
        {notice && (
          <Notice type={notice.type} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Notice>
        )}
        <div className="content-grid">
          <div className="primary-column">
            {!known ? (
              <section className="card settings-card">
                <h2>This page isn’t here.</h2>
                <p className="muted">Let’s get you back to your account.</p>
                <button
                  className="button button-primary"
                  onClick={() => navigate('/')}
                >
                  Go back
                </button>
              </section>
            ) : status === 'loading' ? (
              <section className="card">
                <Loading />
              </section>
            ) : status === 'error' ? (
              <section className="card settings-card">
                <h2>We couldn’t load your account.</h2>
                <Notice error={loadError} />
                <div className="form-actions">
                  <button className="button button-primary" onClick={restore}>
                    Try again
                  </button>
                  <button className="button button-secondary" onClick={signOut}>
                    Sign out
                  </button>
                </div>
              </section>
            ) : authenticated ? (
              <AccountPage />
            ) : (
              <AuthPage
                key={path}
                mode={path === '/register' ? 'register' : 'login'}
              />
            )}
          </div>
          <Directory />
        </div>
      </div>
      <footer>
        <span>Fieldnote</span>
        <span>A little space for you.</span>
      </footer>
    </main>
  );
}
