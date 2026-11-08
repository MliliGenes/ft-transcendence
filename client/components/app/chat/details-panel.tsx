"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconCalendar, IconCrown, IconHash, IconLogout, IconSettings, IconUserCheck, IconUserPlus } from "@tabler/icons-react";
import { useAuth } from "@/components/auth/auth-provider";
import { ChatMarkdown } from "@/components/app/chat/chat-markdown";
import { AccountAvatar } from "@/components/app/account-avatar";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { StatusDot, presenceLabel } from "@/components/app/status-dot";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { accountApi } from "@/lib/accounts/client";
import { accountImageSource } from "@/lib/accounts/images";
import { accountDisplayName } from "@/lib/accounts/status-icons";
import { StatusIcon } from "@/components/app/status-icon";
import { chatApi, type ChatChannel, type ChatGroup, type ChatUser, type GroupMember } from "@/lib/chat/client";
import { friendshipQueryKey, socialApi } from "@/lib/social/client";

const joined = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
export const groupDetailKey = (userId: string | undefined, groupId: string) => ["chat", "group", userId, groupId] as const;
export const groupMembersKey = (userId: string | undefined, groupId: string) => ["chat", "group-members", userId, groupId] as const;

function PanelSection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="border-t border-border px-5 py-4">
    <header className="mb-2 flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-muted-foreground">{title}</h3>{action}</header>
    {children}
  </section>;
}


/** Discord-style profile card for the other person in a direct conversation. */
export function DirectDetails({ user, presence }: { user: ChatUser; presence: string | undefined }) {
  const { session, requestWithSession } = useAuth();
  const queryClient = useQueryClient();
  const name = accountDisplayName(user);
  const profile = useQuery({
    queryKey: ["accounts", "public", user.id],
    queryFn: () => accountApi.getPublic(user.id),
    retry: false,
    staleTime: 60_000,
  });
  const friendships = useQuery({
    queryKey: friendshipQueryKey(session?.user.id),
    queryFn: () => requestWithSession(token => socialApi.getFriendshipState(token)),
    enabled: Boolean(session),
    retry: false,
  });
  const addFriend = useMutation({
    mutationFn: () => requestWithSession(token => socialApi.addFriend(user.id, token)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendshipQueryKey(session?.user.id) }),
  });
  const banner = accountImageSource(profile.data?.bannerUrl ?? null);
  const isFriend = friendships.data?.friends.some(friend => friend.id === user.id);
  const sent = friendships.data?.outgoing.some(request => request.addresseeId === user.id);
  const incoming = friendships.data?.incoming.some(request => request.requesterId === user.id);

  return <div className="flex min-h-full flex-col">
    <div className="relative h-28 shrink-0 bg-muted">
      {banner && <Image src={banner} alt="" fill sizes="320px" unoptimized className="object-cover" />}
    </div>
    <div className="px-5">
      <div className="relative -mt-10 inline-block">
        <div className="size-20 overflow-hidden border-[5px] border-card bg-muted">
          <AccountAvatar source={accountImageSource(user.avatarUrl)} seed={user.id} label={`${name} avatar`} size={80} className="size-full object-cover" />
        </div>
        <StatusDot status={presence} ring className="absolute right-0 bottom-0 size-4" />
      </div>
      <h2 className="mt-2 truncate text-xl font-semibold tracking-tight">{name}</h2>
      <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><StatusDot status={presence} />{presenceLabel(presence)}</p>
      {profile.data?.statusText && <p className="mt-3 flex items-start gap-2 bg-nook-accent-subtle px-3 py-2 text-sm">
        <StatusIcon name={profile.data.statusIcon} className="mt-0.5 shrink-0 text-primary" />
        <span className="min-w-0 break-words">{profile.data.statusText}</span>
      </p>}
    </div>

    <div className="mt-4">
      <PanelSection title="About me">
        {profile.isPending ? <div className="grid gap-2"><Skeleton className="h-4 w-full rounded-none" /><Skeleton className="h-4 w-2/3 rounded-none" /></div>
          : profile.data?.bio ? <ChatMarkdown className="line-clamp-[8] text-sm">{profile.data.bio}</ChatMarkdown>
            : <p className="text-sm text-muted-foreground">{profile.isError ? "Profile details are unavailable right now." : `${name} hasn’t written a bio yet.`}</p>}
      </PanelSection>
      {profile.data && <PanelSection title="Member since">
        <p className="flex items-center gap-2 text-sm"><IconCalendar size={16} className="text-muted-foreground" aria-hidden="true" />{joined.format(new Date(profile.data.createdAt))}</p>
      </PanelSection>}
      <PanelSection title="Friendship">
        {friendships.isPending ? <Skeleton className="h-5 w-32 rounded-none" />
          : isFriend ? <p className="flex items-center gap-2 text-sm"><IconUserCheck size={17} className="text-primary" aria-hidden="true" />You’re friends</p>
            : sent ? <p className="text-sm text-muted-foreground">Friend request sent</p>
              : incoming ? <Button render={<Link href="/search" />} variant="outline" className="min-h-10 w-full">Review friend request</Button>
                : <>
                  <Button className="min-h-10 w-full" disabled={addFriend.isPending || friendships.isError} onClick={() => addFriend.mutate()}><IconUserPlus size={16} aria-hidden="true" />{addFriend.isPending ? "Sending…" : "Add friend"}</Button>
                  {addFriend.error && <p role="alert" className="mt-2 text-xs text-destructive">{addFriend.error.message}</p>}
                </>}
      </PanelSection>
    </div>
    <div className="mt-auto border-t border-border p-4">
      <Button render={<Link href={`/profile/${encodeURIComponent(user.id)}`} />} variant="outline" className="min-h-11 w-full">View full profile</Button>
    </div>
  </div>;
}

function GroupMark({ name, className = "size-14 text-lg" }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]?.toUpperCase()).join("") || "#";
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center bg-nook-accent-subtle font-semibold text-nook-accent-text ${className}`}>{initials}</span>;
}
export { GroupMark };

function MemberRow({ member, presence }: { member: GroupMember; presence: string | undefined }) {
  const name = accountDisplayName(member.user);
  const offline = presence !== "ONLINE" && presence !== "AWAY";
  return <li>
    <Link href={`/profile/${encodeURIComponent(member.user.id)}`} className={`flex min-h-12 items-center gap-3 px-5 py-1.5 hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${offline ? "opacity-60 hover:opacity-100" : ""}`}>
      <span className="relative shrink-0">
        <AccountAvatar source={accountImageSource(member.user.avatarUrl)} seed={member.user.id} label={`${name} avatar`} size={32} className="size-8 object-cover" />
        <StatusDot status={presence} ring className="absolute -right-0.5 -bottom-0.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium"><span className="truncate">{name}</span>{member.role === "ADMIN" && <IconCrown size={14} className="shrink-0 text-nook-warning" aria-label="Admin" />}</span>
        <span className="block truncate text-xs text-muted-foreground">{presenceLabel(presence)}</span>
      </span>
    </Link>
  </li>;
}

/** Group/channel information with a presence-sorted member list. */
export function GroupDetails({ group, channel, presence, onManage, onLeft }: {
  group: ChatGroup;
  channel: ChatChannel | undefined;
  presence: Record<string, string>;
  onManage: () => void;
  onLeft: () => void;
}) {
  const { session, requestWithSession } = useAuth();
  const queryClient = useQueryClient();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const isAdmin = group.members?.[0]?.role === "ADMIN";
  const detail = useQuery({
    queryKey: groupDetailKey(session?.user.id, group.id),
    queryFn: () => requestWithSession(token => chatApi.group(group.id, token)),
    enabled: Boolean(session),
    retry: false,
  });
  const members = useQuery({
    queryKey: groupMembersKey(session?.user.id, group.id),
    queryFn: () => requestWithSession(token => chatApi.groupMembers(group.id, token)),
    enabled: Boolean(session),
    retry: false,
  });
  const leave = useMutation({
    mutationFn: () => requestWithSession(token => chatApi.leaveGroup(group.id, token)),
    onSuccess: async () => {
      setConfirmLeave(false);
      await queryClient.invalidateQueries({ queryKey: ["chat", "groups", session?.user.id] });
      onLeft();
    },
  });
  const rank = (status: string | undefined) => status === "ONLINE" ? 0 : status === "AWAY" ? 1 : 2;
  const sorted = [...(members.data ?? [])].sort((a, b) => rank(presence[a.user.id]) - rank(presence[b.user.id]) || accountDisplayName(a.user).localeCompare(accountDisplayName(b.user)));
  const admins = sorted.filter(member => member.role === "ADMIN");
  const regular = sorted.filter(member => member.role !== "ADMIN");
  const onlineCount = sorted.filter(member => rank(presence[member.user.id]) < 2).length;
  const rules = detail.data?.rules ?? group.rules;

  return <div className="flex min-h-full flex-col">
    <div className="flex items-center gap-3 px-5 pt-6 pb-4">
      <GroupMark name={group.name} />
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold tracking-tight">{group.name}</h2>
        <p className="text-xs text-muted-foreground tabular-nums">{members.data ? <>{members.data.length} {members.data.length === 1 ? "member" : "members"} · {onlineCount} online</> : "Loading members…"}</p>
      </div>
    </div>
    {channel && <PanelSection title="Channel">
      <p className="flex items-center gap-1.5 text-sm font-medium"><IconHash size={16} className="text-muted-foreground" aria-hidden="true" />{channel.name}</p>
      <p className="mt-1 text-sm text-muted-foreground">{channel.topic || "No topic set."}</p>
    </PanelSection>}
    <PanelSection title="Rules">
      {detail.isPending && !rules ? <Skeleton className="h-4 w-3/4 rounded-none" /> : rules ? <ChatMarkdown className="line-clamp-[10] text-sm text-muted-foreground">{rules}</ChatMarkdown> : <p className="text-sm text-muted-foreground">No rules have been set.</p>}
    </PanelSection>
    <section className="border-t border-border py-3" aria-label="Members">
      {members.isPending && <div className="grid gap-3 px-5 py-2">{[0, 1, 2].map(item => <div key={item} className="flex items-center gap-3"><Skeleton className="size-8 rounded-none" /><Skeleton className="h-4 flex-1 rounded-none" /></div>)}</div>}
      {members.isError && <div className="px-5 py-2"><p role="alert" className="text-sm text-destructive">Could not load members.</p><Button variant="outline" className="mt-2 min-h-10" onClick={() => void members.refetch()}>Try again</Button></div>}
      {admins.length > 0 && <><h3 className="px-5 pt-2 pb-1 text-xs font-semibold text-muted-foreground">Admins — {admins.length}</h3><ul>{admins.map(member => <MemberRow key={member.user.id} member={member} presence={presence[member.user.id]} />)}</ul></>}
      {regular.length > 0 && <><h3 className="px-5 pt-3 pb-1 text-xs font-semibold text-muted-foreground">Members — {regular.length}</h3><ul>{regular.map(member => <MemberRow key={member.user.id} member={member} presence={presence[member.user.id]} />)}</ul></>}
    </section>
    <div className="mt-auto grid gap-2 border-t border-border p-4">
      {isAdmin && <Button className="min-h-11 w-full" onClick={onManage}><IconSettings size={17} aria-hidden="true" />Manage group</Button>}
      <Button variant="ghost" className="min-h-11 w-full text-destructive hover:text-destructive" onClick={() => setConfirmLeave(true)}><IconLogout size={17} aria-hidden="true" />Leave group</Button>
      {leave.error && <p role="alert" className="text-xs text-destructive">{leave.error.message}</p>}
    </div>
    <ConfirmDialog open={confirmLeave} onOpenChange={setConfirmLeave} title={`Leave ${group.name}?`} description="You’ll lose access to its channels until an admin adds you again." confirmLabel="Leave group" pendingLabel="Leaving…" pending={leave.isPending} destructive onConfirm={() => leave.mutate()} />
  </div>;
}
