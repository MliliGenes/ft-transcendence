"use client";

import { ProfileAvatar } from "./profile-avatar";
import { profileImageUrl, type AccountProfile } from "@/lib/accounts/client";

export function AccountAvatar({ profile, size = 40, className = "" }: {
  profile: AccountProfile;
  size?: number;
  className?: string;
}) {
  const url = profileImageUrl(profile, "avatar");
  return <span className={`block shrink-0 overflow-hidden rounded-full bg-nook-surface ${className}`} style={{ width: size, height: size }}>
    {url
      // User images are served through the API with no-store headers.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img key={url} src={url} alt={`${profile.username}'s avatar`} width={size} height={size} referrerPolicy="no-referrer" className="size-full object-cover" />
      : <ProfileAvatar username={profile.username} size={size} className="size-full" />}
  </span>;
}
