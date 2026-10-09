import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { imageError } from '../lib/account.js';
import { Notice } from './Notice.jsx';

export function ImageUpload({ kind }) {
  const { updateAccount, mutating } = useAuth();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const input = useRef(null);
  const id = useId();
  const name = kind === 'avatar' ? 'Avatar' : 'Banner';
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(event) {
    const selected = event.target.files?.[0] || null;
    const message = imageError(selected, kind);
    setSaved(false);
    setError(message ? new Error(message) : null);
    setFile(message ? null : selected);
    if (message) event.target.value = '';
  }
  async function upload(event) {
    event.preventDefault();
    if (!file || mutating) return;
    const body = new FormData();
    body.append('file', file);
    setError(null);
    setSaved(false);
    try {
      await updateAccount(`/accounts/me/${kind}`, { method: 'PUT', body });
      setFile(null);
      input.current.value = '';
      setSaved(true);
    } catch (e) {
      setError(e);
    }
  }
  return (
    <form
      className="upload-form"
      onSubmit={upload}
      aria-label={`Change ${kind}`}
    >
      <fieldset disabled={mutating}>
        <div>
          <label htmlFor={id}>{name}</label>
          <p className="field-hint">
            {kind === 'avatar'
              ? 'Square crop · Up to 1 MB'
              : 'Wide crop · Up to 5 MB'}
            . JPEG, PNG or WebP.
          </p>
        </div>
        {preview && (
          <img
            className={`upload-preview preview-${kind}`}
            src={preview}
            alt={`Preview of your new ${kind}`}
          />
        )}
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={choose}
        />
        <Notice error={error} />
        {saved && <Notice type="success">{name} updated.</Notice>}
        <div className="upload-actions">
          {file && (
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={() => {
                setFile(null);
                input.current.value = '';
                setError(null);
              }}
            >
              Remove selection
            </button>
          )}
          <button
            type="submit"
            className="button button-secondary button-small"
            disabled={!file}
          >
            {mutating && file ? 'Uploading…' : `Upload ${kind}`}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
