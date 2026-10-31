import { useEffect } from 'react';
import { useAuth } from './auth/AuthProvider.jsx';
import { navigate, useRoute } from './lib/navigation.js';
import { AuthPage } from './pages/AuthPage.jsx';
import { AccountPage } from './pages/AccountPage.jsx';
import { VerifyEmailPage } from './pages/VerifyEmailPage.jsx';
import { PasswordResetPage } from './pages/PasswordResetPage.jsx';
import { PrivacyPage } from './pages/PrivacyPage.jsx';
import { TermsPage } from './pages/TermsPage.jsx';
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
  const known = [
    '/',
    '/login',
    '/register',
    '/account',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/privacy',
    '/terms',
  ].includes(path);
  const passwordReset = path === '/forgot-password' || path === '/reset-password';
  const isPolicy = path === '/privacy' || path === '/terms';

  useEffect(() => {
    if (!known || status === 'loading' || status === 'error') return;
    if (
      status === 'authenticated' &&
      !passwordReset &&
      !isPolicy &&
      path !== '/account' &&
      path !== '/verify-email'
    )
      navigate('/account', { replace: true });
    if (status === 'anonymous' && !isPolicy && (path === '/' || path === '/account'))
      navigate('/login', { replace: true });
  }, [path, status, known, passwordReset, isPolicy]);

  useEffect(() => {
    document.title = `${
      passwordReset
        ? 'Reset password'
        : path === '/verify-email'
        ? 'Verify email'
        : path === '/privacy'
        ? 'Privacy Policy'
        : path === '/terms'
        ? 'Terms of Service'
        : status === 'authenticated'
          ? 'Your profile'
          : path === '/register'
            ? 'Create account'
            : 'Log in'
    } · Fieldnote`;
  }, [path, status, passwordReset]);

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
              <a className="button button-secondary button-small" href="/play/">
                Play
              </a>
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
        <p className="eyebrow">{isPolicy ? 'Legal & Compliance' : 'Your space'}</p>
        <h1>
          {path === '/privacy'
            ? 'Privacy Policy'
            : path === '/terms'
            ? 'Terms of Service'
            : authenticated
            ? 'Make it yours.'
            : 'A place to connect.'}
        </h1>
        <p className="lede">
          {path === '/privacy'
            ? 'How Fieldnote and Code Arena protect your data, credentials, and privacy.'
            : path === '/terms'
            ? 'The rules, sandbox boundaries, and fair-play policies governing our services.'
            : authenticated
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
            ) : passwordReset ? (
              <PasswordResetPage key={path} confirm={path === '/reset-password'} />
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
            ) : path === '/verify-email' ? (
              <VerifyEmailPage />
            ) : path === '/privacy' ? (
              <PrivacyPage />
            ) : path === '/terms' ? (
              <TermsPage />
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
        <div className="footer-meta">
          <span>Fieldnote</span>
          <span>·</span>
          <span>A little space for you.</span>
        </div>
        <nav className="footer-links" aria-label="Legal">
          <a
            href="/privacy"
            onClick={(event) => {
              event.preventDefault();
              navigate('/privacy');
            }}
          >
            Privacy Policy
          </a>
          <span>·</span>
          <a
            href="/terms"
            onClick={(event) => {
              event.preventDefault();
              navigate('/terms');
            }}
          >
            Terms of Service
          </a>
        </nav>
      </footer>
    </main>
  );
}
