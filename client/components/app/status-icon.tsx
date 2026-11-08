import { IconCode, IconCoffee, IconDeviceGamepad2, IconMoon, IconMusic } from "@tabler/icons-react";

const statusIcons = { IconCode, IconCoffee, IconMoon, IconMusic, IconDeviceGamepad2 } as const;

/** Renders a profile's chosen status icon, or nothing for unknown/empty names. */
export function StatusIcon({ name, size = 16, className }: { name: string | null | undefined; size?: number; className?: string }) {
  if (!name || !(name in statusIcons)) return null;
  const Icon = statusIcons[name as keyof typeof statusIcons];
  return <Icon size={size} className={className} aria-hidden="true" />;
}
