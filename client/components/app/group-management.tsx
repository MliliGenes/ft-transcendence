"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconHash, IconUserMinus } from "@tabler/icons-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { accountApi } from "@/lib/accounts/client";
import { chatApi, type ChatGroup, type ChatChannel } from "@/lib/chat/client";

const groupsKey = (id?: string) => ["chat", "groups", id] as const;

export function GroupManagement({ group, activeChannelId, onLeave, onChannelDeleted }: {
  group: ChatGroup;
  activeChannelId: string;
  onLeave: () => void;
  onChannelDeleted: () => void;
}) {
  const { session, requestWithSession } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = group.members?.[0]?.role === "ADMIN";
  const [memberSearch, setMemberSearch] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelTopic, setChannelTopic] = useState("");
  const detail = useQuery({
    queryKey: ["chat", "group", session?.user.id, group.id],
    queryFn: () => requestWithSession(token => chatApi.group(group.id, token)),
    enabled: Boolean(session),
    retry: false,
  });
  const members = useQuery({
    queryKey: ["chat", "group-members", session?.user.id, group.id],
    queryFn: () => requestWithSession(token => chatApi.groupMembers(group.id, token)),
    enabled: Boolean(session),
    retry: false,
  });
  const people = useQuery({
    queryKey: ["chat", "group-add-people", group.id, memberSearch.trim()],
    queryFn: () => accountApi.searchPeople(memberSearch.trim(), 1, 8),
    enabled: Boolean(session && isAdmin && memberSearch.trim().length >= 2),
    retry: false,
  });
  const refreshGroup = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: groupsKey(session?.user.id) }),
    queryClient.invalidateQueries({ queryKey: ["chat", "group", session?.user.id, group.id] }),
    queryClient.invalidateQueries({ queryKey: ["chat", "group-members", session?.user.id, group.id] }),
  ]);
  const addMember = useMutation({
    mutationFn: (userId: string) => requestWithSession(token => chatApi.addGroupMember(group.id, userId, token)),
    onSuccess: async () => { setMemberSearch(""); await refreshGroup(); },
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => requestWithSession(token => chatApi.removeGroupMember(group.id, userId, token)),
    onSuccess: refreshGroup,
  });
  const leave = useMutation({
    mutationFn: () => requestWithSession(token => chatApi.leaveGroup(group.id, token)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: groupsKey(session?.user.id) });
      onLeave();
    },
  });
  const createChannel = useMutation({
    mutationFn: () => requestWithSession(token => chatApi.createChannel(group.id, { name: channelName.trim(), topic: channelTopic.trim() || undefined }, token)),
    onSuccess: async () => { setChannelName(""); setChannelTopic(""); await refreshGroup(); },
  });
  const allErrors = [detail.error, members.error, people.error, addMember.error, removeMember.error, leave.error, createChannel.error].filter(Boolean);
  const currentMembers = members.data ?? [];
  const candidates = (people.data?.users ?? []).filter(person => person.id !== session?.user.id && !currentMembers.some(member => member.user.id === person.id));

  function submitChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (channelName.trim()) createChannel.mutate();
  }

  return <section className="max-h-[45svh] shrink-0 overflow-y-auto border-b border-border bg-card/50 p-4" aria-label={`${group.name} management`}>
    {isAdmin ? <>
      {detail.data ? <GroupDetailsEditor key={`${group.id}:${detail.data.updatedAt ?? group.id}`} groupId={group.id} name={detail.data.name} rules={detail.data.rules ?? ""} onSaved={refreshGroup} /> : <p role="status" className="text-sm text-muted-foreground">Loading group details…</p>}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Members <span className="font-normal text-muted-foreground">({currentMembers.length})</span></h3>
          {members.isPending && <p role="status" className="mt-2 text-sm text-muted-foreground">Loading members…</p>}
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {currentMembers.map(member => <li key={member.user.id} className="flex min-h-11 items-center gap-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{member.user.displayName?.trim() || member.user.username} <span className="text-muted-foreground">@{member.user.username}</span></span>
              <span className="text-xs text-muted-foreground">{member.role.toLowerCase()}</span>
              {member.user.id !== session?.user.id && <Button type="button" variant="ghost" size="icon" className="size-9" aria-label={`Remove ${member.user.username}`} title={`Remove ${member.user.username}`} disabled={removeMember.isPending} onClick={() => removeMember.mutate(member.user.id)}><IconUserMinus size={16} aria-hidden="true" /></Button>}
            </li>)}
          </ul>
          <label className="mt-3 grid gap-1 text-xs font-medium">Add a member<Input value={memberSearch} onChange={event => setMemberSearch(event.target.value)} maxLength={100} placeholder="Search by username" className="h-10" /></label>
          {people.isPending && <p role="status" className="mt-2 text-xs text-muted-foreground">Searching…</p>}
          {people.isError && <p role="alert" className="mt-2 text-xs text-destructive">Could not search people.</p>}
          <ul className="mt-1 max-h-32 overflow-y-auto">{candidates.map(person => <li key={person.id} className="flex items-center gap-2 py-1.5"><span className="min-w-0 flex-1 truncate text-sm">{person.displayName?.trim() || person.username} <span className="text-muted-foreground">@{person.username}</span></span><Button type="button" size="sm" variant="outline" className="min-h-9" disabled={addMember.isPending} onClick={() => addMember.mutate(person.id)}>Add</Button></li>)}</ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Channels</h3>
          <ul className="mt-2 space-y-3">{group.channels.map(channel => <li key={channel.id}><ChannelEditor key={`${channel.id}:${channel.name}:${channel.topic}`} groupId={group.id} channel={channel} onSaved={refreshGroup} onDeleted={async () => { if (channel.id === activeChannelId) onChannelDeleted(); await refreshGroup(); }} /></li>)}</ul>
          <form onSubmit={submitChannel} className="mt-4 grid gap-2 border-t border-border pt-3">
            <h4 className="flex items-center gap-2 text-xs font-semibold"><IconHash size={15} aria-hidden="true" />Add channel</h4>
            <Input value={channelName} onChange={event => setChannelName(event.target.value)} maxLength={80} required aria-label="New channel name" placeholder="Channel name" className="h-10" />
            <Input value={channelTopic} onChange={event => setChannelTopic(event.target.value)} maxLength={500} aria-label="New channel topic" placeholder="Topic (optional)" className="h-10" />
            <Button type="submit" variant="outline" className="min-h-10 justify-self-start" disabled={createChannel.isPending || !channelName.trim()}>Create channel</Button>
          </form>
        </div>
      </div>
    </> : <>
      <h3 className="text-sm font-semibold">{group.name} rules</h3>
      {detail.isPending ? <p role="status" className="mt-2 text-sm text-muted-foreground">Loading group details…</p> : <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{detail.data?.rules || "No group rules have been set."}</p>}
      <h3 className="mt-4 text-sm font-semibold">Members <span className="font-normal text-muted-foreground">({currentMembers.length})</span></h3>
      {members.isPending ? <p role="status" className="mt-2 text-sm text-muted-foreground">Loading members…</p> : <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{currentMembers.map(member => <li key={member.user.id} className="text-sm">{member.user.displayName?.trim() || member.user.username}<span className="ml-1 text-xs text-muted-foreground">{member.role.toLowerCase()}</span></li>)}</ul>}
    </>}
    {allErrors.length > 0 && <p role="alert" className="mt-3 text-sm text-destructive">{allErrors.map(error => errorMessage(error)).join(" ")}</p>}
    <div className="mt-4 flex justify-end border-t border-border pt-3"><Button variant="outline" className="min-h-10 text-destructive" disabled={leave.isPending} onClick={() => { if (window.confirm(`Leave ${group.name}?`)) leave.mutate(); }}>{leave.isPending ? "Leaving…" : "Leave group"}</Button></div>
  </section>;
}

function ChannelEditor({ groupId, channel, onSaved, onDeleted }: { groupId: string; channel: ChatChannel; onSaved: () => Promise<unknown>; onDeleted: () => Promise<void> }) {
  const { requestWithSession } = useAuth();
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? "");
  const update = useMutation({
    mutationFn: () => requestWithSession(token => chatApi.updateChannel(groupId, channel.id, { name: name.trim(), topic: topic.trim() }, token)),
    onSuccess: onSaved,
  });
  const remove = useMutation({ mutationFn: () => requestWithSession(token => chatApi.deleteChannel(groupId, channel.id, token)), onSuccess: onDeleted });
  return <form onSubmit={event => { event.preventDefault(); if (name.trim()) update.mutate(); }} className="grid gap-2 border border-border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto_auto] sm:items-center">
    <Input value={name} onChange={event => setName(event.target.value)} maxLength={80} required aria-label={`${channel.name} channel name`} className="h-10" />
    <Input value={topic} onChange={event => setTopic(event.target.value)} maxLength={500} aria-label={`${channel.name} topic`} placeholder="Channel topic" className="h-10" />
    <Button type="submit" variant="outline" className="min-h-10" disabled={update.isPending || !name.trim()}>Save</Button>
    <Button type="button" variant="ghost" className="min-h-10 text-destructive" disabled={remove.isPending || update.isPending} onClick={() => { if (window.confirm(`Delete #${channel.name} and its message history?`)) remove.mutate(); }}>Delete</Button>
    {(update.error || remove.error) && <p role="alert" className="text-xs text-destructive sm:col-span-4">{errorMessage(update.error ?? remove.error)}</p>}
  </form>;
}

function GroupDetailsEditor({ groupId, name: initialName, rules: initialRules, onSaved }: { groupId: string; name: string; rules: string; onSaved: () => Promise<unknown> }) {
  const { requestWithSession } = useAuth();
  const [name, setName] = useState(initialName);
  const [rules, setRules] = useState(initialRules);
  const save = useMutation({
    mutationFn: () => requestWithSession(token => chatApi.updateGroup(groupId, { name: name.trim(), rules: rules.trim() }, token)),
    onSuccess: onSaved,
  });
  return <form onSubmit={event => { event.preventDefault(); if (name.trim()) save.mutate(); }} className="mb-4 grid gap-3 border-b border-border pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
    <label className="grid gap-1 text-xs font-medium">Group name<Input value={name} onChange={event => setName(event.target.value)} maxLength={100} required aria-label="Group name" className="h-10" /></label>
    <label className="grid gap-1 text-xs font-medium">Group rules<Textarea value={rules} onChange={event => setRules(event.target.value)} maxLength={4000} aria-label="Group rules" placeholder="Set expectations for this group" className="min-h-10" /></label>
    <Button type="submit" variant="outline" className="min-h-10" disabled={save.isPending || !name.trim()}>Save details</Button>
    {save.error && <p role="alert" className="text-xs text-destructive sm:col-span-3">{errorMessage(save.error)}</p>}
  </form>;
}

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Please try again."; }
