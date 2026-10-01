export function Notice({ type = 'error', children, error, onDismiss }) {
  if (!children && !error) return null;
  const messages = error?.messages || (error ? [error.message] : []);
  return (
    <div
      className={`notice notice-${type}`}
      role={type === 'error' ? 'alert' : 'status'}
    >
      <div>
        {children}
        {messages.length > 1 ? (
          <ul>
            {messages.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        ) : (
          messages[0]
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          className="icon-button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          ×
        </button>
      )}
    </div>
  );
}

export function Loading({ text = 'Loading your account…' }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}
