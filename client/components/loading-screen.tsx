import { NookLogo } from '@/components/nook-logo';

/** Route-level loading state. `fullscreen` is for pages outside the app shell. */
export function LoadingScreen({
  fullscreen = false,
}: {
  fullscreen?: boolean;
}) {
  return (
    <div
      role="status"
      className={`flex flex-1 items-center justify-center px-6 py-16 ${fullscreen ? 'min-h-screen' : ''}`}
    >
      <NookLogo className="animate-pulse text-6xl motion-reduce:animate-none" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
