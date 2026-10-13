import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { profilePatch, toProfileForm } from '../lib/account.js';
import { Notice } from './Notice.jsx';

export function ProfileForm() {
  const { profile, updateAccount, mutating } = useAuth();
  const baseline = useRef(toProfileForm(profile));
  const [values, setValues] = useState(baseline.current);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const patch = profilePatch(values, baseline.current);
  const dirty = Object.keys(patch).length > 0;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const reset = () => {
    baseline.current = toProfileForm(profile);
    setValues(baseline.current);
    setSaved(false);
    setError(null);
  };
  const change = (event) => {
    setValues((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setSaved(false);
  };
  async function submit(event) {
    event.preventDefault();
    if (!dirty || mutating) return;
    setError(null);
    setSaved(false);
    try {
      const updated = await updateAccount('/accounts/me', {
        method: 'PATCH',
        json: patch,
      });
      baseline.current = toProfileForm(updated);
      setValues(baseline.current);
      setSaved(true);
    } catch (e) {
      setError(e);
    }
  }
  return (
    <section className="card settings-card" aria-labelledby="details-heading">
      <div className="section-heading">
        <div>
          <h2 id="details-heading">Profile details</h2>
          <p className="muted">A few details that make your account yours.</p>
        </div>
      </div>
      <form onSubmit={submit} aria-busy={mutating}>
        <fieldset disabled={mutating}>
          <div className="field-grid">
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
              />
            </label>
            <label>
              Display name
              <input
                name="displayName"
                value={values.displayName}
                onChange={change}
                maxLength={50}
                placeholder="How people see your name"
              />
            </label>
          </div>
          <div className="field-grid">
            <label>
              First name
              <input
                name="firstName"
                autoComplete="given-name"
                value={values.firstName}
                onChange={change}
                maxLength={50}
              />
            </label>
            <label>
              Last name
              <input
                name="lastName"
                autoComplete="family-name"
                value={values.lastName}
                onChange={change}
                maxLength={50}
              />
            </label>
          </div>
          <label>
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={values.email}
              onChange={change}
              required
              spellCheck={false}
            />
            <span className="field-hint">
              Used to sign in. Changes take effect when you save.
            </span>
          </label>
          {patch.email !== undefined && patch.email !== profile.email && (
            <Notice type="warning">
              Changing your email will clear its current verification status.
            </Notice>
          )}
          <Notice error={error} />
          {saved && (
            <Notice type="success">Your profile details are up to date.</Notice>
          )}
          <div className="form-actions">
            <span className="field-hint">
              {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
            </span>
            <button
              type="button"
              className="button button-secondary"
              onClick={reset}
              disabled={!dirty}
            >
              Discard
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={!dirty}
            >
              {mutating ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
