export type AuthMode = 'login' | 'register';
export type AuthField = 'username' | 'email' | 'password';
export type AuthErrors = Partial<Record<AuthField, string>>;

export function validateNewPassword(password: string) {
  const length = Array.from(password).length;
  if (length < 8 || length > 32) return 'Use 8–32 characters.';
  if (new TextEncoder().encode(password).length > 72)
    return 'Password must be no more than 72 UTF-8 bytes.';
  return undefined;
}

// Contract: docs/api/user-service.openapi.json; login byte limit confirmed in LoginDto.
// Client checks are feedback only; the service must validate again on submission.
export function validateAuth(
  mode: AuthMode,
  values: Record<AuthField, string>,
): AuthErrors {
  const errors: AuthErrors = {};
  if (mode === 'register') {
    const length = Array.from(values.username).length;
    if (length < 3 || length > 30)
      errors.username = 'Use between 3 and 30 characters.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Enter a valid email address, such as name@example.com.';
  }
  const passwordLength = Array.from(values.password).length;
  if (!passwordLength) {
    errors.password = 'Enter your password.';
  } else if (
    mode === 'register' &&
    (passwordLength < 8 || passwordLength > 32)
  ) {
    errors.password = 'Use between 8 and 32 characters.';
  } else if (new TextEncoder().encode(values.password).length > 72) {
    errors.password =
      'Password exceeds 72 UTF-8 bytes. Emojis and some characters use extra bytes; try a shorter password.';
  }
  return errors;
}
