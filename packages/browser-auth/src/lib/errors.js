// Shared API errors and canonical session fault constructors.

export class ApiError extends Error {
  constructor(message, status = 0, messages = [message], code = '') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.code = code;
  }
}

export function changedSession() {
  return new ApiError(
    'Your session changed. Please try again.',
    401,
    undefined,
    'SESSION_CHANGED',
  );
}

export function expiredSession(message = 'Your session expired. Please sign in again.') {
  return new ApiError(message, 401, undefined, 'SESSION_EXPIRED');
}

export function unavailableSession(error) {
  const status = error instanceof ApiError ? error.status : 0;
  return new ApiError(
    'The service could not be reached. Your session is kept and will resume.',
    status,
    undefined,
    'UNAVAILABLE',
  );
}
