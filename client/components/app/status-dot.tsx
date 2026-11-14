import { cn } from 'cn';

export type Presence = 'ONLINE' | 'AWAY' | 'OFFLINE' | string | undefined;

export function presenceLabel(status: Presence) {
  return status === 'ONLINE'
    ? 'Online'
    : status === 'AWAY'
      ? 'Away'
      : 'Offline';
}

/** Small presence marker. Always pair with text or an accessible label; colour is never the only signal. */
export function StatusDot({
  status,
  className,
  ring = false,
}: {
  status: Presence;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full',
        status === 'ONLINE'
          ? 'bg-nook-success shadow-[0_0_6px_var(--nook-success)]'
          : status === 'AWAY'
            ? 'bg-nook-warning'
            : 'bg-nook-text-muted',
        ring && 'ring-[3px] ring-card',
        className,
      )}
    />
  );
}
