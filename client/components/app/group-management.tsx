"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconArrowLeft, IconCrown, IconCrownOff, IconHash, IconInfoCircle, IconPlus, IconSearch, IconTrash, IconUserMinus, IconUserPlus, IconUsers } from "@tabler/icons-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AccountAvatar } from "@/components/app/account-avatar";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { GroupMark, groupDetailKey, groupMembersKey } from "@/components/app/chat/details-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { accountApi } from "@/lib/accounts/client";
import { accountImageSource } from "@/lib/accounts/images";
import { accountDisplayName } from "@/lib/accounts/status-icons";
import { chatApi, type ChatChannel, type ChatGroup, type GroupMember } from "@/lib/chat/client";

const groupsKey = (id?: string) => ["chat", "groups", id] as const;
const fieldLabel = "grid gap-1.5 text-sm font-medium";

function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Please try again."; }

const sections = [
  { value: "overview", label: "Overview", description: "The name, description and rules everyone sees on the group page.", Icon: IconInfoCircle },
  { value: "channels", label: "Channels", description: "Organise conversations into topics.", Icon: IconHash },
  { value: "members", label: "Members", description: "Invite people and manage who belongs here.", Icon: IconUsers },
] as const;
export type Section = (typeof sections)[number]["value"];
const sectionTabClass = "flex min-h-11 items-center gap-2.5 px-3 text-left text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-[active]:bg-muted data-[active]:font-medium data-[active]:text-foreground md:w-full md:border-l-2 md:border-transparent md:data-[active]:border-primary max-md:border-b-2 max-md:border-transparent max-md:data-[active]:border-primary max-md:data-[active]:bg-transparent";

/** Admin settings for a group, rendered in place of the conversation inside the chat window. */
export function GroupSettingsView({ group, activeChannelId, initialSection = "overview", onClose, onChannelDeleted }: {
  initialSection?: Section;
  group: ChatGroup;
  activeChannelId: string;
  onClose: () => void;
  onChannelDeleted: () => void;
}) {
  const { session, requestWithSession } = useAuth();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>(initialSection);
  const current = sections.find(item => item.value === section) ?? sections[0];
  const activeChannel = group.channels.find(channel => channel.id === activeChannelId);
  const detail = useQuery({
    queryKey: groupDetailKey(session?.user.id, group.id),
    queryFn: () => requestWithSession(token => chatApi.group(group.id, token)),
    enabled: Boolean(session),
    retry: false,
  });
  const refreshGroup = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: groupsKey(session?.user.id) }),
    queryClient.invalidateQueries({ queryKey: groupDetailKey(session?.user.id, group.id) }),
    queryClient.invalidateQueries({ queryKey: groupMembersKey(session?.user.id, group.id) }),
  ]);

  return <section className="flex min-h-0 flex-1 flex-col" aria-labelledby="group-settings-title" onKeyDown={event => { if (event.key === "Escape" && !event.defaultPrevented && event.target === event.currentTarget) onClose(); }}>
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
      <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={activeChannel ? `Back to #${activeChannel.name}` : "Back to chat"} title="Back to chat" onClick={onClose}><IconArrowLeft size={20} aria-hidden="true" /></Button>
      <GroupMark name={group.name} className="size-9 text-xs" />
      <div className="min-w-0 flex-1">
        <h2 id="group-settings-title" className="truncate font-semibold">{group.name} settings</h2>
        <p className="truncate text-xs text-muted-foreground">You’re an admin of this group</p>
      </div>
      <Button variant="outline" className="hidden min-h-10 px-4 sm:inline-flex" onClick={onClose}>Done</Button>
    </header>
    <Tabs.Root value={section} onValueChange={value => setSection(value as Section)} orientation="vertical" className="flex min-h-0 flex-1 flex-col md:flex-row">
      <Tabs.List aria-label="Group settings sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 md:w-56 md:flex-col md:gap-0.5 md:overflow-visible md:border-r md:border-b-0 md:bg-card md:px-2 md:py-4">
        <p className="hidden px-3 pb-2 text-xs font-semibold text-muted-foreground md:block">Group settings</p>
        {sections.map(({ value, label, Icon }) => <Tabs.Tab key={value} value={value} className={sectionTabClass}>
          <Icon size={18} aria-hidden="true" className="shrink-0" /><span>{label}</span>
          {value === "channels" && <span className="ml-auto text-xs text-muted-foreground tabular-nums">{group.channels.length}</span>}
        </Tabs.Tab>)}
      </Tabs.List>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8 sm:py-8">
          <header className="mb-6"><h3 className="text-xl font-semibold tracking-tight">{current.label}</h3><p className="mt-1 text-sm text-muted-foreground">{current.description}</p></header>
          <Tabs.Panel value="overview" className="outline-none">
            {detail.data ? <GroupDetailsEditor key={`${group.id}:${detail.data.updatedAt ?? ""}`} groupId={group.id} name={detail.data.name} description={detail.data.description ?? ""} rules={detail.data.rules ?? ""} onSaved={refreshGroup} />
              : detail.isError ? <div><p role="alert" className="text-sm text-destructive">{errorMessage(detail.error)}</p><Button variant="outline" className="mt-3 min-h-10" onClick={() => void detail.refetch()}>Try again</Button></div>
                : <div className="grid gap-4"><Skeleton className="h-11" /><Skeleton className="h-32" /></div>}
          </Tabs.Panel>
          <Tabs.Panel value="channels" className="outline-none">
            <ChannelsTab group={group} onSaved={refreshGroup} onDeleted={async channelId => { if (channelId === activeChannelId) onChannelDeleted(); await refreshGroup(); }} />
          </Tabs.Panel>
          <Tabs.Panel value="members" className="outline-none">
            <MembersTab group={group} enabled onChanged={refreshGroup} />
          </Tabs.Panel>
        </div>
      </div>
    </Tabs.Root>
  </section>;
}

function GroupDetailsEditor({ groupId, name: initialName, description: initialDescription, rules: initialRules, onSaved }: { groupId: string; name: string; description: string; rules: string; onSaved: () => Promise<unknown> }) {
  const { requestWithSession } = useAuth();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [rules, setRules] = useState(initialRules);
  const [saved, setSaved] = useState(false);
  const dirty = name.trim() !== initialName || description.trim() !== initialDescription.trim() || rules.trim() !== initialRules.trim();
  const save = useMutation({
    mutationFn: () => requestWithSession(token => chatApi.updateGroup(groupId, { name: name.trim(), description: description.trim(), rules: rules.trim() }, token)),
    onSuccess: async () => { setSaved(true); await onSaved(); },
  });
  return <form onSubmit={event => { event.preventDefault(); if (name.trim()) save.mutate(); }} className="grid gap-5">
    <label className={fieldLabel}>Group name<Input value={name} onChange={event => setName(event.target.value)} maxLength={100} required className="h-11" /></label>
    <label className={fieldLabel}>
      <span className="flex items-baseline justify-between">Description <span className="text-xs font-normal text-muted-foreground tabular-nums">{description.length}/1000</span></span>
      <Textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} placeholder="What is this group about? Shown at the top of the group page." className="min-h-24" />
    </label>
    <label className={fieldLabel}>
      <span className="flex items-baseline justify-between">Rules <span className="text-xs font-normal text-muted-foreground tabular-nums">{rules.length}/4000</span></span>
      <Textarea value={rules} onChange={event => setRules(event.target.value)} maxLength={4000} placeholder="Set expectations for this group. Markdown is supported." className="min-h-36" />
    </label>
    {save.error && <p role="alert" className="text-sm text-destructive">{errorMessage(save.error)}</p>}
    <div className="flex items-center justify-end gap-3">
      {saved && !dirty && <p role="status" className="text-sm text-muted-foreground">Changes saved</p>}
      <Button type="submit" className="min-h-11 px-5" disabled={save.isPending || !name.trim() || !dirty}>{save.isPending ? "Saving…" : "Save changes"}</Button>
    </div>
  </form>;
}

function ChannelsTab({ group, onSaved, onDeleted }: { group: ChatGroup; onSaved: () => Promise<unknown>; onDeleted: (channelId: string) => Promise<void> }) {
  const { requestWithSession } = useAuth();
  const [channelName, setChannelName] = useState("");
  const [channelTopic, setChannelTopic] = useState("");
  const create = useMutation({
    mutationFn: () => requestWithSession(token => chatApi.createChannel(group.id, { name: channelName.trim(), topic: channelTopic.trim() || undefined }, token)),
    onSuccess: async () => { setChannelName(""); setChannelTopic(""); await onSaved(); },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (channelName.trim()) create.mutate();
  }
  return <div className="grid gap-6">
    <ul className="divide-y divide-border border-y border-border">
      {group.channels.map(channel => <li key={channel.id}><ChannelEditor key={`${channel.id}:${channel.name}:${channel.topic}`} groupId={group.id} channel={channel} onSaved={onSaved} onDeleted={() => onDeleted(channel.id)} canDelete={group.channels.length > 1} /></li>)}
    </ul>
    <form onSubmit={submit} className="grid gap-3 bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><IconPlus size={16} aria-hidden="true" />New channel</h3>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="relative"><span className="sr-only">Channel name</span><IconHash size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input value={channelName} onChange={event => setChannelName(event.target.value)} maxLength={80} required placeholder="channel-name" className="h-11 pl-9" /></label>
        <label><span className="sr-only">Channel topic</span><Input value={channelTopic} onChange={event => setChannelTopic(event.target.value)} maxLength={500} placeholder="Topic (optional)" className="h-11" /></label>
      </div>
      {create.error && <p role="alert" className="text-sm text-destructive">{errorMessage(create.error)}</p>}
      <Button type="submit" className="min-h-11 justify-self-end px-5" disabled={create.isPending || !channelName.trim()}>{create.isPending ? "Creating…" : "Create channel"}</Button>
    </form>
  </div>;
}

function ChannelEditor({ groupId, channel, onSaved, onDeleted, canDelete }: { groupId: string; channel: ChatChannel; onSaved: () => Promise<unknown>; onDeleted: () => Promise<void>; canDelete: boolean }) {
  const { requestWithSession } = useAuth();
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = name.trim() !== channel.name || topic.trim() !== (channel.topic ?? "");
  const update = useMutation({
    mutationFn: () => requestWithSession(token => chatApi.updateChannel(groupId, channel.id, { name: name.trim(), topic: topic.trim() }, token)),
    onSuccess: onSaved,
  });
  const remove = useMutation({
    mutationFn: () => requestWithSession(token => chatApi.deleteChannel(groupId, channel.id, token)),
    onSuccess: async () => { setConfirmDelete(false); await onDeleted(); },
  });
  return <form onSubmit={event => { event.preventDefault(); if (name.trim() && dirty) update.mutate(); }} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center">
    <label className="relative"><span className="sr-only">Name of #{channel.name}</span><IconHash size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input value={name} onChange={event => setName(event.target.value)} maxLength={80} required className="h-10 pl-9" /></label>
    <label><span className="sr-only">Topic of #{channel.name}</span><Input value={topic} onChange={event => setTopic(event.target.value)} maxLength={500} placeholder="No topic" className="h-10" /></label>
    <div className="flex gap-1 justify-self-end">
      <Button type="submit" variant={dirty ? "default" : "outline"} className="min-h-10 px-3" disabled={update.isPending || !name.trim() || !dirty}>{update.isPending ? "Saving…" : "Save"}</Button>
      <Button type="button" variant="ghost" size="icon" className="size-10 text-destructive hover:text-destructive" aria-label={`Delete #${channel.name}`} title={canDelete ? `Delete #${channel.name}` : "A group needs at least one channel"} disabled={!canDelete || remove.isPending} onClick={() => setConfirmDelete(true)}><IconTrash size={17} aria-hidden="true" /></Button>
    </div>
    {(update.error || remove.error) && <p role="alert" className="text-xs text-destructive sm:col-span-3">{errorMessage(update.error ?? remove.error)}</p>}
    <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Delete #${channel.name}?`} description="This permanently removes the channel and its entire message history." confirmLabel="Delete channel" pendingLabel="Deleting…" pending={remove.isPending} destructive onConfirm={() => remove.mutate()} />
  </form>;
}

function MembersTab({ group, enabled, onChanged }: { group: ChatGroup; enabled: boolean; onChanged: () => Promise<unknown> }) {
  const { session, requestWithSession } = useAuth();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [removing, setRemoving] = useState<GroupMember | null>(null);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);
  const members = useQuery({
    queryKey: groupMembersKey(session?.user.id, group.id),
    queryFn: () => requestWithSession(token => chatApi.groupMembers(group.id, token)),
    enabled: Boolean(session) && enabled,
    retry: false,
  });
  const people = useQuery({
    queryKey: ["chat", "group-add-people", group.id, debounced],
    queryFn: () => accountApi.searchPeople(debounced, 1, 8),
    enabled: Boolean(session) && debounced.length >= 2,
    retry: false,
  });
  const addMember = useMutation({
    mutationFn: (userId: string) => requestWithSession(token => chatApi.addGroupMember(group.id, userId, token)),
    onSuccess: async () => { setSearch(""); await onChanged(); },
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => requestWithSession(token => chatApi.removeGroupMember(group.id, userId, token)),
    onSuccess: async () => { setRemoving(null); await onChanged(); },
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: GroupMember["role"] }) => requestWithSession(token => chatApi.updateGroupMemberRole(group.id, userId, role, token)),
    onSuccess: async () => { await members.refetch(); await onChanged(); },
  });
  const current = members.data ?? [];
  const candidates = (people.data?.users ?? []).filter(person => person.id !== session?.user.id && !current.some(member => member.user.id === person.id));
  const sorted = [...current].sort((a, b) => (a.role === b.role ? 0 : a.role === "ADMIN" ? -1 : 1) || accountDisplayName(a.user).localeCompare(accountDisplayName(b.user)));

  return <div className="grid gap-6">
    <div>
      <label htmlFor="group-add-member" className="text-sm font-medium">Add people</label>
      <div className="relative mt-1.5"><IconSearch size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="group-add-member" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} placeholder="Search by name or username" autoComplete="off" className="h-11 pl-9" /></div>
      {debounced.length >= 2 && <div className="mt-2 border border-border" aria-live="polite">
        {people.isPending && <p role="status" className="p-3 text-sm text-muted-foreground">Searching…</p>}
        {people.isError && <p role="alert" className="p-3 text-sm text-destructive">Could not search people.</p>}
        {people.isSuccess && candidates.length === 0 && <p className="p-3 text-sm text-muted-foreground">No one new matches “{debounced}”.</p>}
        <ul className="max-h-52 overflow-y-auto">{candidates.map(person => <li key={person.id} className="flex items-center gap-3 px-3 py-2">
          <AccountAvatar source={accountImageSource(person.avatarUrl)} seed={person.id} label={`${accountDisplayName(person)} avatar`} size={32} className="size-8 object-cover" />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{accountDisplayName(person)}</span><span className="block truncate text-xs text-muted-foreground">@{person.username}</span></span>
          <Button type="button" variant="outline" className="min-h-9 px-3" disabled={addMember.isPending} onClick={() => addMember.mutate(person.id)}><IconUserPlus size={15} aria-hidden="true" />Add</Button>
        </li>)}</ul>
      </div>}
      {addMember.error && <p role="alert" className="mt-2 text-sm text-destructive">{errorMessage(addMember.error)}</p>}
    </div>
    <div>
      <h3 className="text-sm font-semibold">Members <span className="font-normal text-muted-foreground tabular-nums">{current.length}</span></h3>
      {members.isPending && <div className="mt-3 grid gap-3">{[0, 1, 2].map(item => <Skeleton key={item} className="h-10" />)}</div>}
      {members.isError && <p role="alert" className="mt-2 text-sm text-destructive">{errorMessage(members.error)}</p>}
      <ul className="mt-2 divide-y divide-border border-y border-border">
        {sorted.map(member => {
          const name = accountDisplayName(member.user);
          const self = member.user.id === session?.user.id;
          return <li key={member.user.id} className="flex min-h-14 items-center gap-3 py-2">
            <AccountAvatar source={accountImageSource(member.user.avatarUrl)} seed={member.user.id} label={`${name} avatar`} size={36} className="size-9 object-cover" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{name}{self && <span className="font-normal text-muted-foreground"> (you)</span>}</span><span className="block truncate text-xs text-muted-foreground">@{member.user.username}</span></span>
            {member.role === "ADMIN"
              ? <span className="inline-flex items-center gap-1 bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"><IconCrown size={13} className="text-nook-warning" aria-hidden="true" />Admin</span>
              : <span className="bg-secondary px-2 py-0.5 text-xs text-muted-foreground">Member</span>}
            {!self && (member.role === "ADMIN"
              ? <Button type="button" variant="ghost" size="icon" className="size-10" aria-label={`Remove admin role from ${name}`} title="Remove admin" disabled={changeRole.isPending} onClick={() => changeRole.mutate({ userId: member.user.id, role: "MEMBER" })}><IconCrownOff size={17} aria-hidden="true" /></Button>
              : <Button type="button" variant="ghost" size="icon" className="size-10" aria-label={`Make ${name} an admin`} title="Make admin" disabled={changeRole.isPending} onClick={() => changeRole.mutate({ userId: member.user.id, role: "ADMIN" })}><IconCrown size={17} aria-hidden="true" /></Button>)}
            {!self && <Button type="button" variant="ghost" size="icon" className="size-10 text-destructive hover:text-destructive" aria-label={`Remove ${name}`} title={`Remove ${name}`} disabled={removeMember.isPending} onClick={() => setRemoving(member)}><IconUserMinus size={17} aria-hidden="true" /></Button>}
          </li>;
        })}
      </ul>
      {removeMember.error && <p role="alert" className="mt-2 text-sm text-destructive">{errorMessage(removeMember.error)}</p>}
      {changeRole.error && <p role="alert" className="mt-2 text-sm text-destructive">{errorMessage(changeRole.error)}</p>}
    </div>
    <ConfirmDialog open={Boolean(removing)} onOpenChange={next => { if (!next) setRemoving(null); }} title={`Remove ${removing ? accountDisplayName(removing.user) : "member"}?`} description={`They’ll lose access to ${group.name} and its channels.`} confirmLabel="Remove member" pendingLabel="Removing…" pending={removeMember.isPending} destructive onConfirm={() => { if (removing) removeMember.mutate(removing.user.id); }} />
  </div>;
}
