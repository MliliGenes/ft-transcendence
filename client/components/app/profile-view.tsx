"use client";

import { useState } from "react";
import Link from "next/link";
import { IconBrandDiscord, IconBrandGithub, IconCalendar, IconDeviceGamepad2, IconEdit, IconMountain } from "@tabler/icons-react";
import { AccountAvatar } from "./account-avatar";
import { AccountStatus } from "./account-status";
import { ProfileStatus } from "./profile-status";
import { useAccount } from "@/lib/accounts/use-account";
import { profileImageUrl, profileName } from "@/lib/accounts/client";

type ProfileTab = "Posts" | "About" | "Games";

export function ProfileView() {
  const account = useAccount();
  const [tab, setTab] = useState<ProfileTab>("Posts");
  if (!account.query.data || !account.session) return <AccountStatus account={account} />;
  const profile = account.query.data;
  const name = profileName(profile);
  const banner = profileImageUrl(profile, "banner");
  const joined = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(profile.createdAt));

  return <section aria-labelledby="profile-name" className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
    <div className="relative flex h-36 items-center justify-center bg-nook-surface text-nook-text-muted sm:h-44 lg:h-52">
      {banner
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={banner} alt="Your profile banner" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
        : <Link href="/settings" className="flex min-h-11 items-center gap-2 text-sm hover:text-foreground"><IconMountain size={22} stroke={1.5} aria-hidden="true" />Add a profile banner</Link>}
      <div className="absolute -bottom-14 left-4 sm:left-5">
        <div className="relative">
          <AccountAvatar profile={profile} size={132} className="border-4 border-background outline outline-border" />
          <div className="absolute left-[calc(100%+20px)] top-3/4 w-[calc(100vw-11.5rem)] max-w-[320px] -translate-y-1/2 sm:w-[min(48vw,360px)]">
            <ProfileStatus statusText={profile.statusText} statusIcon={profile.statusIcon} />
          </div>
        </div>
      </div>
    </div>
    <div className="mt-4 flex flex-col gap-5 px-4 pt-10 sm:flex-row sm:justify-between sm:px-5 sm:pt-0">
      <div className="min-w-0 mt-14">
        <h1 id="profile-name" className="break-words text-3xl font-semibold tracking-tight">{name}</h1>
        <p className="mt-1 text-sm text-nook-text-muted">@{profile.username}</p>
        {profile.bio && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-nook-text-secondary">{profile.bio}</p>}
        <p className="mt-4 inline-flex items-center gap-2 text-xs text-nook-text-muted"><IconCalendar size={17} stroke={1.75} aria-hidden="true" />Joined {joined}</p>
      </div>
      <Link href="/settings" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start border border-border px-5 text-sm font-medium hover:bg-nook-surface"><IconEdit size={18} stroke={1.75} aria-hidden="true" />Edit profile</Link>
    </div>
    <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div role="group" aria-label="Profile sections" className="flex gap-7 border-b border-border">
          {(["Posts", "About", "Games"] as const).map(item => <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)} className={`relative min-h-12 px-1 text-sm focus-visible:outline-2 focus-visible:outline-ring ${tab === item ? "font-medium text-foreground after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:bg-primary" : "text-nook-text-secondary hover:text-foreground"}`}>{item}</button>)}
        </div>
        <div className="mt-5 border border-border px-6 py-12 text-center">
          {tab === "Posts" ? <><p className="text-sm font-medium">A little quiet here</p><p className="mt-2 text-sm text-nook-text-muted">Your posts will appear here.</p></> : tab === "About" ? <><p className="text-sm font-medium">{name}</p>{profile.bio && <p className="mx-auto mt-3 max-w-xl whitespace-pre-wrap text-sm leading-6 text-nook-text-secondary">{profile.bio}</p>}<p className="mt-3 text-sm text-nook-text-muted">On Nook since {joined}.</p></> : <><IconDeviceGamepad2 size={28} className="mx-auto text-nook-text-muted" aria-hidden="true" /><p className="mt-3 text-sm text-nook-text-muted">Your game activity will appear here.</p></>}
        </div>
      </div>
      <aside aria-label="Profile details" className="space-y-4">
        <section className="border border-border p-5"><h2 className="text-sm font-semibold">Connections</h2><ul className="mt-4 divide-y divide-border text-sm text-nook-text-secondary">
          <li className="flex items-center gap-3 pb-4"><IconBrandGithub size={25} aria-hidden="true" /><span>GitHub</span><span className="ml-auto text-xs text-nook-text-muted">{profile.hasGithub ? "Connected" : "Not connected"}</span></li>
          <li className="flex items-center gap-3 pt-4"><IconBrandDiscord size={25} aria-hidden="true" /><span>Discord</span><span className="ml-auto text-xs text-nook-text-muted">{profile.hasDiscord ? "Connected" : "Not connected"}</span></li>
        </ul></section>
        <section className="border border-border p-5"><h2 className="text-sm font-semibold">Currently playing</h2><div className="mt-4 flex items-center gap-3 text-nook-text-muted"><IconDeviceGamepad2 size={22} stroke={1.5} aria-hidden="true" /><p className="text-xs leading-5">Game activity coming soon</p></div></section>
      </aside>
    </div>
  </section>;
}
