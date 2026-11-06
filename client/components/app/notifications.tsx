import Link from "next/link";
import { IconBell, IconMessageCircle, IconUserPlus } from "@tabler/icons-react";

const notifications = [
  { icon: IconUserPlus, title: "Maya sent you a friend request", time: "12 min ago", href: "/search", unread: true },
  { icon: IconMessageCircle, title: "Amina mentioned you in Design", time: "1 hr ago", href: "/chat", unread: true },
  { icon: IconMessageCircle, title: "Ravi sent you a message", time: "Yesterday", href: "/chat", unread: false },
];

export function Notifications() {
  return (
    <details className="group relative">
      <summary aria-label="Notifications, 2 unread" className="relative flex size-10 cursor-pointer list-none items-center justify-center text-nook-text-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <IconBell size={21} stroke={1.75} aria-hidden="true" />
        <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />
      </summary>
      <section aria-label="Notifications" className="absolute right-0 top-12 z-30 hidden w-[min(22rem,calc(100vw-5.5rem))] border border-border bg-nook-surface-raised shadow-xl group-open:block">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <span className="text-xs text-nook-text-muted">2 new</span>
        </header>
        <ul>
          {notifications.map(({ icon: Icon, title, time, href, unread }) => (
            <li key={title} className="border-b border-border last:border-0">
              <Link href={href} className="flex min-h-16 items-start gap-3 px-4 py-3 hover:bg-nook-surface-hover focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center bg-nook-surface text-nook-text-secondary"><Icon size={17} stroke={1.75} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block text-xs leading-5 text-foreground">{title}</span><span className="mt-1 block text-[11px] text-nook-text-muted">{time}</span></span>
                {unread && <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
              </Link>
            </li>
          ))}
        </ul>
        <p className="px-4 py-3 text-center text-[11px] text-nook-text-muted">Example notifications</p>
      </section>
    </details>
  );
}
