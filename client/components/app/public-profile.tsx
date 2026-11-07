"use client";

import Image from "next/image";
import Link from "next/link";
import { Tabs } from "@base-ui/react/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconCalendar, IconCheck, IconCode, IconCoffee, IconDeviceGamepad2, IconMoon, IconMusic, IconUserPlus } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import { AccountAvatar } from "@/components/app/account-avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { useCurrentAccount } from "@/hooks/use-current-account";
import { accountApi, type PublicAccount, type UserAccount } from "@/lib/accounts/client";
import { accountImageSource } from "@/lib/accounts/images";
import { friendshipQueryKey, socialApi } from "@/lib/social/client";

const iconByName = {
  IconCode,
  IconCoffee,
  IconMoon,
  IconMusic,
  IconDeviceGamepad2,
} as const;

const profileQueryKey = (id: string) => ["accounts", "public", id] as const;
function publicFields(account: UserAccount): PublicAccount {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    bannerUrl: account.bannerUrl,
    bio: account.bio,
    statusText: account.statusText,
    statusIcon: account.statusIcon,
    createdAt: account.createdAt,
  };
}

function joinedDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function LoadingProfile() {
  return <div role="status" className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8"><span className="sr-only">Loading profile…</span><div className="h-48 animate-pulse bg-muted md:h-64" /><div className="mt-6 h-10 w-56 animate-pulse bg-muted" /><div className="mt-4 h-5 w-80 max-w-full animate-pulse bg-muted" /></div>;
}

export function PublicProfile({ id, ownerRoute = false }: { id?: string; ownerRoute?: boolean }) {
  const { session, isRestoring, requestWithSession } = useAuth();
  const currentAccount = useCurrentAccount();
  const queryClient = useQueryClient();
  const targetId = id ?? session?.user.id ?? "";
  const isOwner = ownerRoute || (!!session && session.user.id === targetId);
  const publicProfile = useQuery({
    queryKey: profileQueryKey(targetId),
    queryFn: () => accountApi.getPublic(targetId),
    enabled: !!targetId && !isRestoring && !isOwner,
    retry: false,
  });
  const friendships = useQuery({
    queryKey: friendshipQueryKey(session?.user.id),
    queryFn: () => requestWithSession(token => socialApi.getFriendshipState(token)),
    enabled: !!session && !isRestoring && !isOwner,
    retry: false,
  });
  const friendshipAction = useMutation({
    mutationFn: ({ action, friendshipId }: { action: "add" | "accept" | "decline" | "cancel"; friendshipId?: string }) => requestWithSession(token => {
      if (action === "add") return socialApi.addFriend(targetId, token);
      if (!friendshipId) throw new Error("This request is no longer available.");
      if (action === "accept") return socialApi.acceptFriend(friendshipId, token);
      if (action === "decline") return socialApi.declineFriend(friendshipId, token);
      return socialApi.removeFriendship(friendshipId, token);
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendshipQueryKey(session?.user.id) }),
  });

  if (isRestoring) return <LoadingProfile />;
  if (ownerRoute && !session) {
    return <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-20 text-center"><h1 className="text-2xl font-semibold">Your profile</h1><p className="mt-2 text-sm text-muted-foreground">Log in to view your profile.</p><Button render={<Link href="/login" />} className="mt-5 min-h-11">Log in</Button></section>;
  }
  if (isOwner && currentAccount.isPending) return <LoadingProfile />;
  if (isOwner && (!currentAccount.data || currentAccount.error)) {
    return <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-20 text-center"><h1 className="text-2xl font-semibold">Unable to load your profile</h1><Button variant="outline" className="mt-5 min-h-11" onClick={() => currentAccount.refetch()}>Try again</Button></section>;
  }
  if (!isOwner && publicProfile.isPending) return <LoadingProfile />;
  if (!isOwner && (publicProfile.error || !publicProfile.data)) {
    return <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-20 text-center"><h1 className="text-2xl font-semibold">Profile not found</h1><p className="mt-2 text-sm text-muted-foreground">This profile may have been removed or the link may be incorrect.</p><Button render={<Link href="/search" />} variant="outline" className="mt-5 min-h-11">Back to search</Button></section>;
  }

  const profile = isOwner ? publicFields(currentAccount.data!) : publicProfile.data!;
  const displayName = profile.displayName?.trim() || profile.username;
  const avatar = accountImageSource(profile.avatarUrl);
  const banner = accountImageSource(profile.bannerUrl);
  const StatusIcon = profile.statusIcon && profile.statusIcon in iconByName
    ? iconByName[profile.statusIcon as keyof typeof iconByName]
    : null;
  const friend = friendships.data?.friends.some(item => item.id === profile.id) ?? false;
  const incoming = friendships.data?.incoming.find(item => item.requesterId === profile.id);
  const outgoing = friendships.data?.outgoing.find(item => item.addresseeId === profile.id);
  const friendActionError = friendshipAction.error instanceof Error ? friendshipAction.error.message : "Unable to update this friendship. Please try again.";

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-5 sm:px-6 md:px-8 md:pt-8" aria-labelledby="public-profile-name">
      <div className="relative h-44 overflow-hidden border border-border bg-muted sm:h-56 md:h-64">
        {!banner && <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,color-mix(in_oklch,var(--primary)_28%,transparent),transparent_48%),linear-gradient(125deg,var(--muted),var(--background)_65%)]" />}
        {banner && <Image src={banner} alt={`${displayName}'s profile banner`} fill sizes="(max-width: 768px) 100vw, 1152px" unoptimized className="object-cover" />}
        {isOwner && <Button render={<Link href="/profile/edit" />} variant="outline" className="absolute right-3 top-3 min-h-11 bg-background/90">{banner ? "Edit banner" : "Add banner"}</Button>}
      </div>

      <header className="relative border-b border-border px-4 pb-6 sm:px-7">
        <div className="flex flex-wrap items-center gap-4">
          <div className="-mt-12 size-24 shrink-0 overflow-hidden border-4 border-background bg-muted sm:-mt-14 sm:size-28">
            <AccountAvatar source={avatar} seed={profile.id} label={`${displayName}'s avatar`} size={112} className="size-full object-cover" />
          </div>
          {profile.statusText && <span className="inline-flex max-w-full items-center gap-2 border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-foreground">{StatusIcon && <StatusIcon size={16} className="shrink-0 text-primary" aria-hidden="true" />}<span className="break-words">{profile.statusText}</span></span>}
          <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
            {isOwner ? <Button render={<Link href="/profile/edit" />} variant="outline" className="min-h-11">Edit profile</Button>
              : !session ? <Button render={<Link href="/login" />} variant="outline" className="min-h-11">Log in to connect</Button>
                : friendships.isPending ? <Button disabled variant="outline" className="min-h-11">Checking friendship…</Button>
                  : friendships.error ? <Button variant="outline" className="min-h-11" onClick={() => friendships.refetch()}>Retry friendship</Button>
                    : friend ? <Button disabled variant="outline" className="min-h-11"><IconCheck size={16} aria-hidden="true" /> Friends</Button>
                      : incoming ? <><Button disabled={friendshipAction.isPending} className="min-h-11" onClick={() => friendshipAction.mutate({ action: "accept", friendshipId: incoming.id })}>Accept request</Button><Button disabled={friendshipAction.isPending} variant="outline" className="min-h-11" onClick={() => friendshipAction.mutate({ action: "decline", friendshipId: incoming.id })}>Decline</Button></>
                        : outgoing ? <Button disabled={friendshipAction.isPending} variant="outline" className="min-h-11" onClick={() => friendshipAction.mutate({ action: "cancel", friendshipId: outgoing.id })}>Cancel request</Button>
                          : <Button disabled={friendshipAction.isPending} className="min-h-11" onClick={() => friendshipAction.mutate({ action: "add" })}><IconUserPlus size={16} aria-hidden="true" />{friendshipAction.isPending ? "Sending…" : "Add friend"}</Button>}
          </div>
        </div>
        <div className="mt-4 min-w-0">
          <h1 id="public-profile-name" className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{displayName}</h1>
          <p className="mt-1 truncate text-sm text-primary">@{profile.username}</p>
        </div>
        {profile.bio && <div className="profile-markdown mt-4 max-w-3xl text-sm leading-6 text-foreground [&_a]:underline [&_a]:decoration-primary [&_a]:underline-offset-2 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_h1]:mb-2 [&_h1]:text-xl [&_h2]:mb-2 [&_h2]:text-lg [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p+p]:mt-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:p-3"><ReactMarkdown>{profile.bio}</ReactMarkdown></div>}
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><IconCalendar size={16} aria-hidden="true" /> Joined {joinedDate(profile.createdAt)}</p>
        {friendshipAction.error && <p role="alert" className="mt-3 text-sm text-destructive">{friendActionError}</p>}
        {friendships.error && <p role="alert" className="mt-3 text-sm text-destructive">Could not load friendship status. Retry to see whether you are already connected.</p>}
      </header>

      <div className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Tabs.Root defaultValue="posts" className="min-w-0">
          <Tabs.List aria-label={`${displayName}'s profile sections`} className="flex gap-1 border-b border-border">
            {["posts", "about", "games"].map(tab => <Tabs.Tab key={tab} value={tab} className="min-h-11 border-b-2 border-transparent px-4 text-sm capitalize text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active]:border-primary data-[active]:font-medium data-[active]:text-foreground">{tab}</Tabs.Tab>)}
          </Tabs.List>
          <Tabs.Panel value="posts" className="min-h-64 border-b border-border px-5 py-12 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring"><h2 className="text-lg font-medium">Posts are coming soon</h2><p className="mt-2 text-sm text-muted-foreground">Posts will appear here when sharing is available.</p></Tabs.Panel>
          <Tabs.Panel value="about" className="min-h-64 border-b border-border px-5 py-7 outline-none focus-visible:ring-2 focus-visible:ring-ring"><h2 className="text-lg font-semibold">About {displayName}</h2><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Username</dt><dd className="mt-1 text-sm">@{profile.username}</dd></div><div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Member since</dt><dd className="mt-1 text-sm">{joinedDate(profile.createdAt)}</dd></div>{profile.statusText && <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt><dd className="mt-1"><span className="inline-flex max-w-full items-center gap-2 border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-foreground">{StatusIcon && <StatusIcon size={16} className="shrink-0 text-primary" aria-hidden="true" />}<span className="break-words">{profile.statusText}</span></span></dd></div>}</dl>{profile.bio && <div className="profile-markdown mt-6 border-t border-border pt-5 text-sm leading-6 [&_a]:underline [&_a]:decoration-primary [&_a]:underline-offset-2 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_h1]:mb-2 [&_h1]:text-xl [&_h2]:mb-2 [&_h2]:text-lg [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p+p]:mt-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:p-3"><ReactMarkdown>{profile.bio}</ReactMarkdown></div>}</Tabs.Panel>
          <Tabs.Panel value="games" className="min-h-64 border-b border-border px-5 py-12 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring"><h2 className="text-lg font-medium">Game activity is coming soon</h2><p className="mt-2 text-sm text-muted-foreground">Games will appear here when activity is available.</p></Tabs.Panel>
        </Tabs.Root>

        <aside className="space-y-4">
          <section className="border border-border bg-card p-5" aria-labelledby="game-activity-title"><h2 id="game-activity-title" className="flex items-center gap-2 text-sm font-semibold"><IconDeviceGamepad2 size={17} className="text-primary" aria-hidden="true" /> Currently playing</h2><p className="mt-3 text-sm text-muted-foreground">Game activity coming soon</p></section>
        </aside>
      </div>
    </section>
  );
}
