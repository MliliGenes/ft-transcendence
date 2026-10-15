import { useState } from 'react';
import { API_URL } from '../lib/runtime.js';
import { mediaUrl } from '../lib/account.js';

export function ProfileImage({
  user,
  banner = false,
  small = false,
  revision,
}) {
  const [failedUrl, setFailedUrl] = useState(null);
  const src = mediaUrl(
    banner ? user.bannerUrl : user.avatarUrl,
    API_URL,
    revision || user.updatedAt,
  );
  const name = user.displayName || user.username;
  const className = banner
    ? 'profile-banner'
    : small
      ? 'avatar avatar-small'
      : 'avatar';
  if (!src || failedUrl === src) {
    return banner ? (
      <div className="profile-banner banner-placeholder" aria-hidden="true" />
    ) : (
      <div
        className={`${className} avatar-placeholder`}
        aria-label={`${name}'s avatar`}
      >
        {Array.from(name || '?')
          .slice(0, 2)
          .join('')
          .toUpperCase()}
      </div>
    );
  }
  return (
    <img
      className={className}
      src={src}
      alt={banner ? '' : `${name}'s avatar`}
      loading={small ? 'lazy' : 'eager'}
      onError={() => setFailedUrl(src)}
    />
  );
}
