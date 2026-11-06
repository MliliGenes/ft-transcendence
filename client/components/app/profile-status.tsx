import {
  IconCode,
  IconCoffee,
  IconDeviceGamepad2,
  IconMoon,
  IconMusic,
} from "@tabler/icons-react";

export const PROFILE_STATUS_ICONS = {
  IconCode,
  IconCoffee,
  IconMoon,
  IconMusic,
  IconDeviceGamepad2,
} as const;

export type ProfileStatusIcon = keyof typeof PROFILE_STATUS_ICONS;

export function ProfileStatus({ statusText, statusIcon }: {
  statusText: string | null;
  statusIcon: string | null;
}) {
  if (!statusText) return null;
  const Icon = statusIcon && statusIcon in PROFILE_STATUS_ICONS
    ? PROFILE_STATUS_ICONS[statusIcon as ProfileStatusIcon]
    : null;

  return <span className="flex w-full min-w-0 items-center gap-2 border-l-2 border-primary bg-nook-surface px-3 py-2 text-sm text-nook-text-secondary">
    {Icon && <Icon size={16} stroke={1.75} className="shrink-0 text-primary" aria-hidden="true" />}
    <span className="break-words">{statusText}</span>
  </span>;
}
