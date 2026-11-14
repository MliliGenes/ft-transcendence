export function accountImageSource(value: string | null) {
  if (!value) return null;
  const imagePath =
    /^\/accounts\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(avatar|banner)$/i;
  if (imagePath.test(value)) return `/api${value}`;
  if (
    /^\/api\/accounts\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(avatar|banner)$/i.test(
      value,
    )
  )
    return value;
  try {
    const url = new URL(value);
    if (
      url.protocol === 'https:' &&
      ((url.hostname === 'cdn.discordapp.com' &&
        url.pathname.startsWith('/avatars/')) ||
        (url.hostname === 'avatars.githubusercontent.com' &&
          url.pathname.startsWith('/')))
    )
      return url.href;
  } catch {
    return null;
  }
  return null;
}
