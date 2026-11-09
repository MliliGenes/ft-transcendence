"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs } from "@base-ui/react/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconBan, IconCalendar, IconDeviceGamepad2, IconDots, IconMessageCircle, IconPencil, IconUserCheck, IconUserMinus, IconUserPlus, IconUsers } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import { AccountAvatar } from "@/components/app/account-avatar";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { ProfilePosts } from "@/components/app/feed/profile-posts";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/auth-provider";
import { useCurrentAccount } from "@/hooks/use-current-account";
import { accountApi, type PublicAccount, type UserAccount } from "@/lib/accounts/client";
import { accountImageSource } from "@/lib/accounts/images";
import { accountDisplayName } from "@/lib/accounts/status-icons";
import { StatusPill } from "@/components/app/status-icon";
import { blocksQueryKey, friendshipQueryKey, socialApi, type FriendshipState } from "@/lib/social/client";
import { chatApi } from "@/lib/chat/client";

const profileQueryKey = (id: string) => ["accounts", "public", id] as const;
const tabClass = "min-h-11 border-b-2 border-transparent px-4 text-sm capitalize text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active]:border-primary data-[active]:font-medium data-[active]:text-foreground";
const markdownClass = "profile-markdown text-sm leading-6 text-foreground [&_a]:underline [&_a]:decoration-primary [&_a]:underline-offset-2 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_h1]:mb-2 [&_h1]:text-xl [&_h2]:mb-2 [&_h2]:text-lg [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p+p]:mt-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:p-3";
const friendPreviewCount = 6;

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
  return <div role="status" className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8"><span className="sr-only">Loading profile…</span><Skeleton className="h-48 md:h-64" /><Skeleton className="-mt-12 ml-7 size-28 border-4 border-background" /><Skeleton className="mt-6 h-10 w-56" /><Skeleton className="mt-4 h-5 w-80 max-w-full" /></div>;
}

function ProfileMessage({ title, body, action }: { title: string; body?: string; action: React.ReactNode }) {
  return <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-20 text-center"><h1 className="text-2xl font-semibold">{title}</h1>{body && <p className="mt-2 text-sm text-muted-foreground">{body}</p>}<div className="mt-5">{action}</div></section>;
}

type PendingConfirm = "remove" | "block" | null;

export function PublicProfile({ id, ownerRoute = false }: { id?: string; ownerRoute?: boolean }) {
  const { session, isRestoring, requestWithSession } = useAuth();
  const currentAccount = useCurrentAccount();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
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
    enabled: !!session && !isRestoring,
    retry: false,
  });
  const friendshipAction = useMutation({
    mutationFn: ({ action, friendshipId }: { action: "add" | "accept" | "decline" | "cancel" | "remove"; friendshipId?: string }) => requestWithSession(token => {
      if (action === "add") return socialApi.addFriend(targetId, token);
      if (!friendshipId) throw new Error("This request is no longer available.");
      if (action === "accept") return socialApi.acceptFriend(friendshipId, token);
      if (action === "decline") return socialApi.declineFriend(friendshipId, token);
      return socialApi.removeFriendship(friendshipId, token);
    }),
    onSuccess: async () => {
      setConfirm(null);
      await queryClient.invalidateQueries({ queryKey: friendshipQueryKey(session?.user.id) });
    },
  });
  const blocks = useQuery({
    queryKey: blocksQueryKey(session?.user.id),
    queryFn: () => requestWithSession(token => socialApi.getBlocks(token)),
    enabled: !!session && !isRestoring && !isOwner,
    retry: false,
  });
  const blockAction = useMutation({
    mutationFn: (unblock: boolean) => requestWithSession(token => unblock ? socialApi.unblockUser(targetId, token) : socialApi.blockUser(targetId, token)),
    onSuccess: async () => {
      setConfirm(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: blocksQueryKey(session?.user.id) }),
        queryClient.invalidateQueries({ queryKey: friendshipQueryKey(session?.user.id) }),
        queryClient.invalidateQueries({ queryKey: ["chat"] }),
      ]);
    },
  });
  const messageAction = useMutation({
    mutationFn: () => requestWithSession(token => chatApi.openDm(targetId, token)),
    onSuccess: async conversation => {
      await queryClient.invalidateQueries({ queryKey: ["chat", "conversations", session?.user.id] });
      router.push(`/chat?conversation=${encodeURIComponent(conversation.id)}`);
    },
  });

  if (isRestoring) return <LoadingProfile />;
  if (ownerRoute && !session) return <ProfileMessage title="Your profile" body="Log in to view your profile." action={<Button render={<Link href="/login" />} className="min-h-11 px-5">Log in</Button>} />;
  if (isOwner && currentAccount.isPending) return <LoadingProfile />;
  if (isOwner && (!currentAccount.data || currentAccount.error)) return <ProfileMessage title="Unable to load your profile" action={<Button variant="outline" className="min-h-11" onClick={() => currentAccount.refetch()}>Try again</Button>} />;
  if (!isOwner && publicProfile.isPending) return <LoadingProfile />;
  if (!isOwner && (publicProfile.error || !publicProfile.data)) return <ProfileMessage title="Profile not found" body="This profile may have been removed or the link may be incorrect." action={<Button render={<Link href="/search" />} variant="outline" className="min-h-11">Back to search</Button>} />;

  const profile = isOwner ? publicFields(currentAccount.data!) : publicProfile.data!;
  const displayName = accountDisplayName(profile);
  const avatar = accountImageSource(profile.avatarUrl);
  const banner = accountImageSource(profile.bannerUrl);
  const friend = friendships.data?.friends.find(item => item.id === profile.id);
  const blocked = blocks.data?.some(item => item.id === profile.id) ?? false;
  const busy = friendshipAction.isPending || blockAction.isPending || messageAction.isPending;
  const incoming = friendships.data?.incoming.find(item => item.requesterId === profile.id);
  const outgoing = friendships.data?.outgoing.find(item => item.addresseeId === profile.id);
  const friendCount = friendships.data?.friends.length;
  const actionError = friendshipAction.error ?? blockAction.error ?? messageAction.error;

  let primaryAction: React.ReactNode = null;
  if (isOwner) primaryAction = <Button render={<Link href="/profile/edit" />} variant="outline" className="min-h-11 px-4"><IconPencil size={16} aria-hidden="true" />Edit profile</Button>;
  else if (!session) primaryAction = <Button render={<Link href="/login" />} className="min-h-11 px-4">Log in to connect</Button>;
  else if (blocks.isPending || friendships.isPending) primaryAction = <Button disabled variant="outline" className="min-h-11 px-4">Checking connection…</Button>;
  else if (blocks.error || friendships.error) primaryAction = <Button variant="outline" className="min-h-11 px-4" onClick={() => { void blocks.refetch(); void friendships.refetch(); }}>Retry connection</Button>;
  else if (blocked) primaryAction = <Button disabled={busy} variant="outline" className="min-h-11 px-4" onClick={() => blockAction.mutate(true)}>{blockAction.isPending ? "Unblocking…" : "Unblock"}</Button>;
  else if (friend) primaryAction = <span className="inline-flex min-h-11 items-center gap-2 bg-secondary px-4 text-sm font-medium"><IconUserCheck size={17} className="text-primary" aria-hidden="true" />Friends</span>;
  else if (incoming) primaryAction = <><Button disabled={busy} className="min-h-11 px-4" onClick={() => friendshipAction.mutate({ action: "accept", friendshipId: incoming.id })}>Accept request</Button><Button disabled={busy} variant="outline" className="min-h-11 px-4" onClick={() => friendshipAction.mutate({ action: "decline", friendshipId: incoming.id })}>Decline</Button></>;
  else if (outgoing) primaryAction = <Button disabled={busy} variant="outline" className="min-h-11 px-4" onClick={() => friendshipAction.mutate({ action: "cancel", friendshipId: outgoing.id })}>{friendshipAction.isPending ? "Cancelling…" : "Cancel request"}</Button>;
  else primaryAction = <Button disabled={busy} className="min-h-11 px-4" onClick={() => friendshipAction.mutate({ action: "add" })}><IconUserPlus size={16} aria-hidden="true" />{friendshipAction.isPending ? "Sending…" : "Add friend"}</Button>;
  const canInteract = !isOwner && !!session && blocks.isSuccess && !blocked;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-5 sm:px-6 md:px-8 md:pt-8" aria-labelledby="public-profile-name">
      <div className="relative h-44 overflow-hidden bg-muted sm:h-56 md:h-64">
        {banner && <Image src={banner} alt={`${displayName}'s profile banner`} fill sizes="(max-width: 768px) 100vw, 1152px" unoptimized className="object-cover" />}
        {isOwner && <Button render={<Link href="/profile/edit" />} variant="outline" className="absolute right-3 top-3 min-h-11 bg-background/90 px-4">{banner ? "Edit banner" : "Add banner"}</Button>}
      </div>

      <header className="relative border-b border-border px-4 pb-6 sm:px-7">
        <div className="flex flex-wrap items-end gap-4">
          <div className="-mt-12 size-24 shrink-0 overflow-hidden border-4 border-background bg-muted sm:-mt-14 sm:size-32">
            <AccountAvatar source={avatar} seed={profile.id} label={`${displayName}'s avatar`} size={128} className="size-full object-cover" />
          </div>
          {profile.statusText && <StatusPill text={profile.statusText} icon={profile.statusIcon} className="mb-1 min-w-0 max-w-[calc(100%-7.5rem)] sm:max-w-md" />}
          <div className="ml-auto flex w-full flex-wrap items-center gap-2 pt-3 sm:w-auto">
            {primaryAction}
            {canInteract && <Button disabled={busy} variant="outline" className="min-h-11 px-4" onClick={() => messageAction.mutate()}><IconMessageCircle size={16} aria-hidden="true" />{messageAction.isPending ? "Opening…" : "Message"}</Button>}
            {canInteract && <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" className="size-11" aria-label="More actions" disabled={busy} />}><IconDots size={18} aria-hidden="true" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {friend && <DropdownMenuItem className="min-h-10" onClick={() => setConfirm("remove")}><IconUserMinus aria-hidden="true" />Remove friend</DropdownMenuItem>}
                <DropdownMenuItem variant="destructive" className="min-h-10" onClick={() => setConfirm("block")}><IconBan aria-hidden="true" />Block {displayName}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>}
          </div>
        </div>
        <div className="mt-4 min-w-0">
          <h1 id="public-profile-name" className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{displayName}</h1>
          <p className="mt-1 truncate text-sm text-nook-accent-text">@{profile.username}</p>
        </div>
        {profile.bio && <div className={`${markdownClass} mt-4 max-w-3xl`}><ReactMarkdown>{profile.bio}</ReactMarkdown></div>}
        <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><IconCalendar size={16} aria-hidden="true" /><dt className="sr-only">Joined</dt><dd>Joined {joinedDate(profile.createdAt)}</dd></div>
          {isOwner && friendCount !== undefined && <div className="flex items-center gap-2"><IconUsers size={16} aria-hidden="true" /><dt className="sr-only">Friends</dt><dd><span className="font-semibold text-foreground tabular-nums">{friendCount}</span> {friendCount === 1 ? "friend" : "friends"}</dd></div>}
        </dl>
        {actionError && <p role="alert" className="mt-3 text-sm text-destructive">{actionError.message || "Unable to update this connection. Please try again."}</p>}
      </header>

      <div className="grid gap-8 pt-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Tabs.Root defaultValue="posts" className="min-w-0">
          <Tabs.List aria-label={`${displayName}'s profile sections`} className="flex gap-1 border-b border-border">
            {["posts", "about", "games"].map(tab => <Tabs.Tab key={tab} value={tab} className={tabClass}>{tab}</Tabs.Tab>)}
          </Tabs.List>
          <Tabs.Panel value="posts" className="min-h-64 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"><ProfilePosts userId={profile.id} name={displayName} isOwner={isOwner} /></Tabs.Panel>
          <Tabs.Panel value="about" className="min-h-64 px-1 py-7 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <h2 className="text-lg font-semibold">About {displayName}</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div><dt className="text-xs font-medium text-muted-foreground">Username</dt><dd className="mt-1 text-sm">@{profile.username}</dd></div>
              <div><dt className="text-xs font-medium text-muted-foreground">Member since</dt><dd className="mt-1 text-sm">{joinedDate(profile.createdAt)}</dd></div>
              {profile.statusText && <div className="sm:col-span-2"><dt className="text-xs font-medium text-muted-foreground">Status</dt><dd className="mt-1 text-sm">{profile.statusText}</dd></div>}
            </dl>
            {profile.bio && <div className={`${markdownClass} mt-6 border-t border-border pt-5`}><ReactMarkdown>{profile.bio}</ReactMarkdown></div>}
          </Tabs.Panel>
          <Tabs.Panel value="games" className="min-h-64 px-5 py-14 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring"><h2 className="text-lg font-medium">Game activity is coming soon</h2><p className="mt-2 text-sm text-muted-foreground">Games will appear here when activity is available.</p></Tabs.Panel>
        </Tabs.Root>

        <aside className="grid content-start gap-4" aria-label="Profile sidebar">
          {isOwner ? <FriendsCard state={friendships.data} isPending={friendships.isPending} isError={friendships.isError} onRetry={() => void friendships.refetch()} />
            : session && <ConnectionCard name={displayName} friend={Boolean(friend)} incoming={Boolean(incoming)} outgoing={Boolean(outgoing)} blocked={blocked} loading={friendships.isPending || blocks.isPending} />}
          <section className="bg-card p-5" aria-labelledby="game-activity-title"><h2 id="game-activity-title" className="flex items-center gap-2 text-sm font-semibold"><IconDeviceGamepad2 size={17} className="text-primary" aria-hidden="true" />Currently playing</h2><p className="mt-3 text-sm text-muted-foreground">Game activity coming soon.</p></section>
        </aside>
      </div>

      <ConfirmDialog open={confirm === "remove"} onOpenChange={open => { if (!open) setConfirm(null); }} title={`Remove ${displayName} from your friends?`} description="You can send a new friend request later." confirmLabel="Remove friend" pendingLabel="Removing…" pending={friendshipAction.isPending} destructive onConfirm={() => friend && friendshipAction.mutate({ action: "remove", friendshipId: friend.friendshipId })} />
      <ConfirmDialog open={confirm === "block"} onOpenChange={open => { if (!open) setConfirm(null); }} title={`Block ${displayName}?`} description="This also removes your friendship and prevents direct messages between you." confirmLabel="Block" pendingLabel="Blocking…" pending={blockAction.isPending} destructive onConfirm={() => blockAction.mutate(false)} />
    </section>
  );
}

function FriendsCard({ state, isPending, isError, onRetry }: { state: FriendshipState | undefined; isPending: boolean; isError: boolean; onRetry: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const friends = [...(state?.friends ?? [])].sort((a, b) => accountDisplayName(a).localeCompare(accountDisplayName(b)));
  const visible = showAll ? friends : friends.slice(0, friendPreviewCount);
  const pending = state?.incoming.length ?? 0;
  return <section className="bg-card" aria-labelledby="friends-title">
    <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-3">
      <h2 id="friends-title" className="text-sm font-semibold">Friends {state && <span className="ml-1 font-normal text-muted-foreground tabular-nums">{friends.length}</span>}</h2>
      <Link href="/search" className="text-xs text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring">Find people</Link>
    </header>
    {pending > 0 && <Link href="/search" className="mx-5 mb-3 flex items-center justify-between gap-2 bg-nook-accent-subtle px-3 py-2 text-sm hover:underline focus-visible:outline-2 focus-visible:outline-ring"><span><span className="font-semibold tabular-nums">{pending}</span> pending {pending === 1 ? "request" : "requests"}</span><span className="text-xs text-nook-accent-text">Review</span></Link>}
    {isPending && <div role="status" aria-label="Loading friends" className="grid gap-3 px-5 pb-5">{[0, 1, 2].map(item => <div key={item} className="flex items-center gap-3"><Skeleton className="size-10" /><Skeleton className="h-4 flex-1" /></div>)}</div>}
    {isError && <div className="px-5 pb-5"><p role="alert" className="text-sm text-destructive">Could not load friends.</p><Button variant="outline" className="mt-2 min-h-10" onClick={onRetry}>Try again</Button></div>}
    {state && friends.length === 0 && <div className="px-5 pb-5"><p className="text-sm text-muted-foreground">No friends yet. Find people you know and send a request.</p><Button render={<Link href="/search" />} variant="outline" className="mt-3 min-h-10 w-full">Find people</Button></div>}
    {visible.length > 0 && <ul className="pb-2">{visible.map(friend => {
      const name = accountDisplayName(friend);
      return <li key={friend.id}><Link href={`/profile/${encodeURIComponent(friend.id)}`} className="flex min-h-14 items-center gap-3 px-5 py-2 hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        <AccountAvatar source={accountImageSource(friend.avatarUrl)} seed={friend.id} label={`${name} avatar`} size={40} className="size-10 shrink-0 object-cover" />
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{name}</span><span className="block truncate text-xs text-muted-foreground">@{friend.username}</span></span>
      </Link></li>;
    })}</ul>}
    {friends.length > friendPreviewCount && <div className="border-t border-border px-2 py-1"><Button variant="ghost" className="min-h-11 w-full text-muted-foreground" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? "Show fewer" : `Show all ${friends.length} friends`}</Button></div>}
  </section>;
}

function ConnectionCard({ name, friend, incoming, outgoing, blocked, loading }: { name: string; friend: boolean; incoming: boolean; outgoing: boolean; blocked: boolean; loading: boolean }) {
  const text = blocked ? `You’ve blocked ${name}. Unblock them to message or connect again.`
    : friend ? `You and ${name} are friends.`
      : incoming ? `${name} sent you a friend request.`
        : outgoing ? `Your friend request is waiting for ${name}.`
          : `You and ${name} aren’t connected yet.`;
  return <section className="bg-card p-5" aria-labelledby="connection-title">
    <h2 id="connection-title" className="flex items-center gap-2 text-sm font-semibold"><IconUsers size={17} className="text-primary" aria-hidden="true" />Connection</h2>
    {loading ? <Skeleton className="mt-3 h-4 w-3/4" /> : <p className="mt-3 text-sm text-muted-foreground">{text}</p>}
  </section>;
}
