import { IconCode, IconCoffee, IconDeviceGamepad2, IconMoon, IconMusic } from "@tabler/icons-react";

const statusIcons = { IconCode, IconCoffee, IconMoon, IconMusic, IconDeviceGamepad2 } as const;

export const statusIconOptions = Object.keys(statusIcons) as (keyof typeof statusIcons)[];

export function statusIconLabel(name: string) {
  return name.replace(/^Icon/, "").replace(/(\d+)$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Renders a profile's chosen status icon, or nothing for unknown/empty names. */
export function StatusIcon({ name, size = 16, className }: { name: string | null | undefined; size?: number; className?: string }) {
  if (!name || !(name in statusIcons)) return null;
  const Icon = statusIcons[name as keyof typeof statusIcons];
  return <Icon size={size} className={className} aria-hidden="true" />;
}

/** Compact status chip: the chosen icon followed by the status text. */
export function StatusPill({ text, icon, className = "" }: { text: string; icon: string | null | undefined; className?: string }) {
  return (
    <p className={`inline-flex max-w-full items-center gap-2 border border-border bg-card px-3 py-1.5 text-sm leading-5 ${className}`}>
      <StatusIcon name={icon} className="shrink-0 text-primary" />
      <span className="min-w-0 break-words">{text}</span>
    </p>
  );
}
