import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { API_URL } from '../lib/runtime.js';
import { navigate } from '../lib/navigation.js';
import { passwordError } from '../lib/account.js';
import { Notice } from '../components/Notice.jsx';

export function AuthPage({ mode }) {
  const { signIn } = useAuth();
  const register = mode === 'register';
  const [values, setValues] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [visible, setVisible] = useState(false);
  const change = (event) =>
    setValues((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const validation = passwordError(values.password, register);
    if (validation) {
      setError(new Error(validation));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body = { email: values.email.trim(), password: values.password };
      if (register) body.username = values.username.trim();
      await signIn(mode, body);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card auth-card" aria-labelledby="auth-heading">
      <nav className="tabs" aria-label="Sign-in options">
        <button
          type="button"
          aria-current={!register ? 'page' : undefined}
          onClick={() => navigate('/login')}
          disabled={busy}
        >
          Log in
        </button>
        <button
          type="button"
          aria-current={register ? 'page' : undefined}
          onClick={() => navigate('/register')}
          disabled={busy}
        >
          Create account
        </button>
      </nav>
      <h2 id="auth-heading">
        {register ? 'Make yourself at home.' : 'Welcome back.'}
      </h2>
      <p className="muted">
        {register
          ? 'Create your account and set up your profile.'
          : 'Sign in to manage your profile and connections.'}
      </p>
      <Notice error={error} />
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy}>
          {register && (
            <label>
              Username
              <input
                name="username"
                autoComplete="username"
                value={values.username}
                onChange={change}
                minLength={3}
                maxLength={30}
                required
                autoFocus
              />
              <span className="field-hint">Between 3 and 30 characters.</span>
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={values.email}
              onChange={change}
              required
              autoFocus={!register}
              spellCheck={false}
            />
          </label>
          <label>
            Password
            <span className="password-field">
              <input
                type={visible ? 'text' : 'password'}
                name="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                value={values.password}
                onChange={change}
                required
              />
              <button
                type="button"
                aria-label={visible ? 'Hide password' : 'Show password'}
                aria-pressed={visible}
                onClick={() => setVisible((value) => !value)}
              >
                {visible ? 'Hide' : 'Show'}
              </button>
            </span>
            {register && (
              <span className="field-hint">
                Use 8–32 characters. Longer phrases are easier to remember.
              </span>
            )}
          </label>
          <button type="submit" className="button button-primary">
            {busy ? 'Please wait…' : register ? 'Create account' : 'Log in'}
            <span aria-hidden="true">↗</span>
          </button>
        </fieldset>
      </form>
      <div className="divider">
        <span>or continue with</span>
      </div>
      <button
        className="button button-discord"
        disabled={busy}
        onClick={() => window.location.assign(`${API_URL}/auth/discord`)}
      >
        Discord<span aria-hidden="true">↗</span>
      </button>
      <button
        className="button button-secondary"
        disabled={busy}
        onClick={() => window.location.assign(`${API_URL}/auth/github`)}
      >
        GitHub<span aria-hidden="true">↗</span>
      </button>
    </section>
  );
}
