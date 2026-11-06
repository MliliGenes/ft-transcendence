"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDeviceGamepad2,
  IconHome2,
  IconMessageCircle,
  IconSearch,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { NookLogo } from "@/components/nook-logo";
import { Notifications } from "@/components/app/notifications";
import { ProfileAvatar } from "@/components/app/profile-avatar";
import { AccountAvatar } from "@/components/app/account-avatar";
import { profileName } from "@/lib/accounts/client";
import { useAccount } from "@/lib/accounts/use-account";

const navigation = [
  { label: "Feed", href: "/feed", Icon: IconHome2 },
  { label: "Search", href: "/search", Icon: IconSearch },
  { label: "Chat", href: "/chat", Icon: IconMessageCircle, unread: true },
  { label: "Play", href: "/play", Icon: IconDeviceGamepad2 },
  { label: "Profile", href: "/profile", Icon: IconUser },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const account = useAccount();
  const profile = account.query.data;
  const currentPage = navigation.find(item => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const title = currentPage?.label ?? (pathname === "/settings" ? "Settings" : "Nook");

  return (
    <div className="flex min-h-screen bg-background text-foreground [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-4 [&_a]:focus-visible:outline-ring">
      <aside aria-label="Application navigation" className="sticky top-0 flex h-dvh w-[68px] shrink-0 flex-col border-r border-border bg-background md:w-[216px]">
        <Link href="/" aria-label="Nook home" className="flex h-16 shrink-0 items-center px-5 md:px-6"><NookLogo className="text-3xl md:text-4xl" /></Link>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-2 py-5 md:px-3">
          {navigation.map(({ label, href, Icon, unread }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={label} href={href} aria-current={active ? "page" : undefined} aria-label={label} title={label} className={`relative flex min-h-12 items-center gap-4 px-3 text-sm transition-colors ${active ? "bg-nook-surface-raised text-foreground" : "text-nook-text-secondary hover:bg-nook-surface hover:text-foreground"}`}>
              <Icon size={21} stroke={1.75} aria-hidden="true" /><span className="hidden md:inline">{label}</span>
              {unread && <span aria-label="Unread messages" className="absolute right-2 size-2 rounded-full bg-primary md:static md:ml-auto" />}
            </Link>;
          })}
        </nav>
        <Link href="/settings" className="flex min-h-[76px] items-center gap-3 border-t border-border px-4 text-nook-text-secondary hover:bg-nook-surface hover:text-foreground md:px-5" aria-label="Account settings" title="Account settings">
          {profile ? <AccountAvatar profile={profile} size={36} /> : <span className="overflow-hidden rounded-full"><ProfileAvatar username={account.session?.user.username ?? "nook"} size={36} /></span>}
          <span className="hidden min-w-0 flex-1 md:block"><span className="block truncate text-xs font-medium text-foreground">{profile ? profileName(profile) : account.session?.user.username ?? "Your account"}</span><span className="block truncate text-xs text-nook-text-muted">{profile ? `@${profile.username}` : "Settings"}</span></span>
          <IconSettings size={20} stroke={1.75} aria-hidden="true" className="hidden md:block" />
        </Link>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-5 md:px-8">
          <p className="truncate text-sm"><span className="text-nook-text-muted">Nook</span><span className="mx-3 text-nook-text-muted" aria-hidden="true">/</span><span className="font-medium">{title}</span></p>
          <div className="flex items-center gap-3 md:gap-4">
            <label className="flex h-10 w-36 items-center gap-2 border border-border bg-nook-surface px-3 text-nook-text-muted sm:w-52 md:w-60">
              <IconSearch size={18} stroke={1.75} aria-hidden="true" />
              <input aria-label="Search Nook" placeholder="Search..." className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-nook-text-muted" />
              <kbd className="hidden border border-border px-1.5 py-0.5 text-[10px] sm:inline">⌘ K</kbd>
            </label>
            <Notifications />
          </div>
        </header>
        <main id="main-content" className="flex-1">{children}</main>
      </div>
    </div>
  );
}
