import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { passwordChangeError } from '../lib/account.js';
import { Notice } from './Notice.jsx';

const empty = { oldPassword: '', newPassword: '', confirmPassword: '' };

export function PasswordForm() {
  const { changePassword, mutating } = useAuth();
  const [values, setValues] = useState(empty);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (mutating) return;
    setError(null);
    setSaved(false);
    const validation = passwordChangeError(values);
    if (validation) {
      setError(new Error(validation));
      return;
    }
    try {
      await changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
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
    <section className="card settings-card" aria-labelledby="password-heading">
      <div className="section-heading">
        <div>
          <h2 id="password-heading">Change password</h2>
          <p className="muted">
            Enter your current password, then choose a new one. Use 8–32
            characters (up to 72 UTF-8 bytes).
          </p>
        </div>
      </div>
      <form onSubmit={submit} aria-busy={mutating}>
        <fieldset disabled={mutating}>
          <div className="field-grid">
            <label>
              Current password
              <input
                type="password"
                name="oldPassword"
                autoComplete="current-password"
                value={values.oldPassword}
                onChange={change}
                required
              />
            </label>
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
              Your password has been updated. Your existing sessions remain
              active.
            </Notice>
          )}
          <div className="form-actions">
            <button type="submit" className="button button-primary">
              {mutating ? 'Please wait…' : 'Update password'}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
