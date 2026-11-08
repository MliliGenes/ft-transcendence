"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconArrowLeft, IconChevronRight, IconCrown, IconHash, IconLogout, IconSettings, IconUserPlus, IconUsers } from "@tabler/icons-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AccountAvatar } from "@/components/app/account-avatar";
import { ChatMarkdown } from "@/components/app/chat/chat-markdown";
import { GroupMark, groupDetailKey, groupMembersKey } from "@/components/app/chat/details-panel";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { StatusDot, presenceLabel } from "@/components/app/status-dot";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { accountImageSource } from "@/lib/accounts/images";
import { accountDisplayName } from "@/lib/accounts/status-icons";
import { chatApi, type ChatGroup, type GroupMember } from "@/lib/chat/client";

const founded = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const joinedFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const rank = (status: string | undefined) => status === "ONLINE" ? 0 : status === "AWAY" ? 1 : 2;

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return <div className="min-w-0"><dd className="text-2xl font-semibold tracking-tight tabular-nums">{value}</dd><dt className="mt-0.5 text-xs text-muted-foreground">{label}</dt></div>;
}

/** Overview of a group: identity, stats, channels, rules and members. Reachable without entering a channel. */
export function GroupHome({ group, presence, showBack, onBack, onOpenChannel, onManage, onLeft }: {
  group: ChatGroup;
  presence: Record<string, string>;
  showBack: boolean;
  onBack: () => void;
  onOpenChannel: (channelId: string) => void;
  onManage: (section?: "overview" | "channels" | "members") => void;
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

  const list = [...(members.data ?? [])].sort((a, b) => rank(presence[a.user.id]) - rank(presence[b.user.id]) || (a.role === b.role ? 0 : a.role === "ADMIN" ? -1 : 1) || accountDisplayName(a.user).localeCompare(accountDisplayName(b.user)));
  const online = list.filter(member => rank(presence[member.user.id]) < 2);
  const me = list.find(member => member.user.id === session?.user.id);
  const description = detail.data?.description ?? group.description;
  const rules = detail.data?.rules ?? group.rules;
  const createdAt = detail.data?.createdAt;
  const unreadTotal = group.channels.reduce((total, channel) => total + channel.unreadCount, 0);

  return <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="group-home-title">
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
      {showBack && <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Back to conversations" onClick={onBack}><IconArrowLeft size={20} aria-hidden="true" /></Button>}
      <IconUsers size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1"><p className="truncate font-semibold">Group overview</p><p className="truncate text-xs text-muted-foreground">{group.name}</p></div>
      {isAdmin && <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Group settings" title="Group settings" onClick={() => onManage()}><IconSettings size={20} aria-hidden="true" /></Button>}
    </header>

    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="border-b border-border bg-card">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-wrap items-start gap-5">
            <GroupMark name={group.name} className="size-20 text-2xl sm:size-24 sm:text-3xl" />
            <div className="min-w-0 flex-1">
              <h1 id="group-home-title" className="text-3xl font-semibold tracking-tight break-words sm:text-4xl">{group.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {me && <span className="inline-flex items-center gap-1.5">{me.role === "ADMIN" ? <><IconCrown size={15} className="text-nook-warning" aria-hidden="true" />You’re an admin</> : "You’re a member"}</span>}
                {me && <span>Joined {joinedFormat.format(new Date(me.joinedAt))}</span>}
              </div>
              {detail.isPending && !description ? <Skeleton className="mt-4 h-4 w-2/3 max-w-md rounded-none" />
                : description ? <p className="mt-4 max-w-[65ch] text-[15px] leading-7 whitespace-pre-line">{description}</p>
                  : isAdmin ? <button type="button" onClick={() => onManage("overview")} className="mt-4 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">Add a description so people know what this group is about</button>
                    : null}
            </div>
          </div>
          <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat value={members.data ? list.length : "–"} label={list.length === 1 ? "Member" : "Members"} />
            <Stat value={members.data ? <span className="inline-flex items-center gap-2">{online.length}<StatusDot status="ONLINE" /></span> : "–"} label="Online now" />
            <Stat value={group.channels.length} label={group.channels.length === 1 ? "Channel" : "Channels"} />
            <Stat value={createdAt ? founded.format(new Date(createdAt)) : "–"} label="Founded" />
          </dl>
          <div className="mt-8 flex flex-wrap gap-2">
            {group.channels[0] && <Button className="min-h-11 px-5" onClick={() => onOpenChannel(group.channels[0].id)}><IconHash size={17} aria-hidden="true" />Open #{group.channels[0].name}</Button>}
            {isAdmin && <Button variant="outline" className="min-h-11 px-4" onClick={() => onManage("members")}><IconUserPlus size={17} aria-hidden="true" />Invite people</Button>}
            {isAdmin && <Button variant="outline" className="min-h-11 px-4" onClick={() => onManage()}><IconSettings size={17} aria-hidden="true" />Settings</Button>}
            <Button variant="ghost" className="min-h-11 px-4 text-destructive hover:text-destructive" onClick={() => setConfirmLeave(true)}><IconLogout size={17} aria-hidden="true" />Leave</Button>
          </div>
          {leave.error && <p role="alert" className="mt-3 text-sm text-destructive">{leave.error.message}</p>}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid content-start gap-10">
          <section aria-labelledby="group-channels-title">
            <header className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="group-channels-title" className="text-lg font-semibold">Channels {unreadTotal > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">{unreadTotal} unread</span>}</h2>
              {isAdmin && <button type="button" onClick={() => onManage("channels")} className="text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring">Manage channels</button>}
            </header>
            <ul className="divide-y divide-border border-y border-border">
              {group.channels.map(channel => <li key={channel.id}>
                <button type="button" onClick={() => onOpenChannel(channel.id)} className="group flex min-h-16 w-full items-center gap-3 px-2 py-3 text-left hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                  <span className="grid size-10 shrink-0 place-items-center bg-muted text-muted-foreground group-hover:bg-background"><IconHash size={19} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${channel.unreadCount > 0 ? "font-semibold" : "font-medium"}`}>{channel.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">{channel.topic || "No topic set"}</span>
                  </span>
                  {channel.unreadCount > 0 && <span className="min-w-6 bg-primary px-1.5 py-0.5 text-center text-xs font-semibold text-primary-foreground tabular-nums" aria-label={`${channel.unreadCount} unread`}>{channel.unreadCount > 99 ? "99+" : channel.unreadCount}</span>}
                  <IconChevronRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>)}
              {group.channels.length === 0 && <li className="px-2 py-6 text-sm text-muted-foreground">No channels yet.{isAdmin && " Create one in settings."}</li>}
            </ul>
          </section>

          <section aria-labelledby="group-rules-title">
            <header className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="group-rules-title" className="text-lg font-semibold">Rules</h2>
              {isAdmin && <button type="button" onClick={() => onManage("overview")} className="text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring">Edit</button>}
            </header>
            {detail.isPending && !rules ? <div className="grid gap-2"><Skeleton className="h-4 w-full rounded-none" /><Skeleton className="h-4 w-3/4 rounded-none" /></div>
              : rules ? <div className="bg-card p-5"><ChatMarkdown>{rules}</ChatMarkdown></div>
                : <p className="text-sm text-muted-foreground">No rules have been set.</p>}
          </section>
        </div>

        <aside aria-labelledby="group-members-title" className="content-start">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="group-members-title" className="text-lg font-semibold">Members <span className="text-sm font-normal text-muted-foreground tabular-nums">{members.data ? list.length : ""}</span></h2>
            {isAdmin && <button type="button" onClick={() => onManage("members")} className="text-sm text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring">Manage</button>}
          </header>
          {members.isPending && <div className="grid gap-3">{[0, 1, 2, 3].map(item => <div key={item} className="flex items-center gap-3"><Skeleton className="size-9 rounded-none" /><Skeleton className="h-4 flex-1 rounded-none" /></div>)}</div>}
          {members.isError && <div><p role="alert" className="text-sm text-destructive">Could not load members.</p><Button variant="outline" className="mt-2 min-h-10" onClick={() => void members.refetch()}>Try again</Button></div>}
          {list.length > 0 && <ul className="-mx-2">{list.map(member => <MemberItem key={member.user.id} member={member} presence={presence[member.user.id]} self={member.user.id === session?.user.id} />)}</ul>}
        </aside>
      </div>
    </div>
    <ConfirmDialog open={confirmLeave} onOpenChange={setConfirmLeave} title={`Leave ${group.name}?`} description="You’ll lose access to its channels until an admin adds you again." confirmLabel="Leave group" pendingLabel="Leaving…" pending={leave.isPending} destructive onConfirm={() => leave.mutate()} />
  </section>;
}

function MemberItem({ member, presence, self }: { member: GroupMember; presence: string | undefined; self: boolean }) {
  const name = accountDisplayName(member.user);
  return <li>
    <Link href={`/profile/${encodeURIComponent(member.user.id)}`} className={`flex min-h-12 items-center gap-3 px-2 py-1.5 hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ${rank(presence) === 2 ? "opacity-60 hover:opacity-100" : ""}`}>
      <span className="relative shrink-0">
        <AccountAvatar source={accountImageSource(member.user.avatarUrl)} seed={member.user.id} label={`${name} avatar`} size={36} className="size-9 object-cover" />
        <StatusDot status={presence} ring className="absolute -right-0.5 -bottom-0.5 ring-background" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium"><span className="truncate">{name}{self && <span className="font-normal text-muted-foreground"> (you)</span>}</span>{member.role === "ADMIN" && <IconCrown size={14} className="shrink-0 text-nook-warning" aria-label="Admin" />}</span>
        <span className="block truncate text-xs text-muted-foreground">{presenceLabel(presence)}</span>
      </span>
    </Link>
  </li>;
}
