import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { passwordSetError } from '../lib/account.js';
import { Notice } from './Notice.jsx';

const empty = { newPassword: '', confirmPassword: '' };

export function SetPasswordForm() {
  const { setPassword, mutating } = useAuth();
  const [values, setValues] = useState(empty);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (mutating) return;
    setError(null);
    setSaved(false);
    const validation = passwordSetError(values);
    if (validation) {
      setError(new Error(validation));
      return;
    }
    try {
      await setPassword({ newPassword: values.newPassword });
      setValues(empty);
      setSaved(true);
    } catch (failure) {
      setError(failure);
    }
  }

  function change(event) {
    setValues((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setSaved(false);
    setError(null);
  }

  return (
    <section
      className="card settings-card"
      aria-labelledby="set-password-heading"
    >
      <div className="section-heading">
        <div>
          <h2 id="set-password-heading">Set a password</h2>
          <p className="muted">
            Add a password so you can sign in without Discord. Use 8–32
            characters (up to 72 UTF-8 bytes).
          </p>
        </div>
      </div>
      <form onSubmit={submit} aria-busy={mutating}>
        <fieldset disabled={mutating}>
          <div className="field-grid">
            <label>
              New password
              <input
                type="password"
                name="newPassword"
                autoComplete="new-password"
                value={values.newPassword}
                onChange={change}
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                value={values.confirmPassword}
                onChange={change}
                required
              />
            </label>
          </div>
          {error && <Notice error={error} />}
          {saved && (
            <Notice type="success">
              Your password has been set. You can now sign in with your email
              and password.
            </Notice>
          )}
          <div className="form-actions">
            <button type="submit" className="button button-primary">
              {mutating ? 'Please wait…' : 'Set password'}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
