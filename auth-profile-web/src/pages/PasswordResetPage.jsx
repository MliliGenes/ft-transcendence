import { useState } from 'react';
import { Notice } from '../components/Notice.jsx';
import { api, sessionStore } from '../lib/runtime.js';
import { navigate } from '../lib/navigation.js';
import { passwordSetError } from '../lib/account.js';

export function PasswordResetPage({ confirm = false }) {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token'));
  const [values, setValues] = useState({ email: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const change = (event) => setValues(current => ({ ...current, [event.target.name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const validation = confirm ? passwordSetError(values) : '';
    if (validation) { setError(new Error(validation)); return; }
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      await api.request(`/auth/password-reset/${confirm ? 'confirm' : 'request'}`, {
        auth: false,
        method: 'POST',
        json: confirm ? { token, newPassword: values.newPassword } : { email: values.email.trim() },
      });
      if (confirm) {
        sessionStore.clear();
        window.history.replaceState(null, '', '/reset-password');
        setValues(current => ({ ...current, newPassword: '', confirmPassword: '' }));
      }
      setSuccess(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card auth-card" aria-labelledby="reset-heading">
      <h2 id="reset-heading">{confirm ? 'Choose a new password' : 'Reset your password'}</h2>
      <Notice error={error} />
      {success && <Notice type="success">
        {confirm ? 'Your password has been reset. Sign in with your new password.' : 'Reset email sent. Check your inbox and spam folder.'}
      </Notice>}
      {confirm && !token && !success && <Notice>This reset link is missing its token. Request a new email below.</Notice>}
      {(!confirm || (token && !success)) && (
        <form onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy}>
            {confirm ? <>
              <label>New password
                <input type="password" name="newPassword" autoComplete="new-password" required
                  value={values.newPassword} onChange={change} />
                <span className="field-hint">Use 8–32 characters, up to 72 UTF-8 bytes.</span>
              </label>
              <label>Confirm new password
                <input type="password" name="confirmPassword" autoComplete="new-password" required
                  value={values.confirmPassword} onChange={change} />
              </label>
            </> : <label>Email address
              <input type="email" name="email" autoComplete="email" required spellCheck={false}
                value={values.email} onChange={change} />
            </label>}
            <button type="submit" className="button button-primary">
              {busy ? 'Please wait…' : confirm ? 'Reset password' : success ? 'Send another reset email' : 'Send reset email'}
            </button>
          </fieldset>
        </form>
      )}
      {!confirm && <p className="muted">Each new request replaces your previous unused reset link.</p>}
      <div className="form-actions">
        {confirm && !success && <button className="button button-secondary" disabled={busy}
          onClick={() => navigate('/forgot-password')}>Request a new reset email</button>}
        <button className="button button-secondary" disabled={busy}
          onClick={() => navigate('/login')}>Back to login</button>
      </div>
    </section>
  );
}
