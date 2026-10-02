export const PROFILE_FIELDS = [
  'username',
  'email',
  'displayName',
  'firstName',
  'lastName',
];
export const IMAGE_LIMITS = { avatar: 1024 * 1024, banner: 5 * 1024 * 1024 };
export const toProfileForm = (user) =>
  Object.fromEntries(PROFILE_FIELDS.map((field) => [field, user[field] ?? '']));

export function profilePatch(values, baseline) {
  return Object.fromEntries(
    PROFILE_FIELDS.filter((field) => values[field] !== baseline[field]).map(
      (field) => [
        field,
        ['username', 'email'].includes(field)
          ? values[field].trim()
          : values[field].trim() || null,
      ],
    ),
  );
}

export function passwordError(password, registering) {
  const length = Array.from(password).length;
  if (registering && (length < 8 || length > 32))
    return 'Use between 8 and 32 characters.';
  if (!length) return 'Enter your password.';
  if (new TextEncoder().encode(password).length > 72)
    return 'This password is too long when encoded. Use fewer special characters.';
  return '';
}

export function passwordChangeError({
  oldPassword,
  newPassword,
  confirmPassword,
}) {
  return (
    passwordError(oldPassword, false) ||
    passwordError(newPassword, true) ||
    (newPassword !== confirmPassword ? 'The new passwords do not match.' : '')
  );
}

export function passwordSetError({ newPassword, confirmPassword }) {
  return (
    passwordError(newPassword, true) ||
    (newPassword !== confirmPassword ? 'The new passwords do not match.' : '')
  );
}

export function imageError(file, kind) {
  if (!file) return '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    return 'Choose a JPEG, PNG or WebP image.';
  if (!file.size || file.size > IMAGE_LIMITS[kind])
    return `Choose an image smaller than ${kind === 'avatar' ? '1' : '5'} MB.`;
  return '';
}

export function mediaUrl(value, baseUrl, revision) {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith('/') ? `${baseUrl}${value}` : value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    if (value.startsWith('/') && revision)
      url.searchParams.set('v', String(revision));
    return url.toString();
  } catch {
    return null;
  }
}
