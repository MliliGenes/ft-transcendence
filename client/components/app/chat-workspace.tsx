"use client";

import { useState, type FormEvent } from "react";
import {
  IconArrowLeft,
  IconDots,
  IconMoodSmile,
  IconPaperclip,
  IconPlus,
  IconSearch,
  IconSend,
  IconUsers,
  IconPin,
} from "@tabler/icons-react";
import { ProfileAvatar } from "@/components/app/profile-avatar";

const conversations = [
  { name: "Amina", handle: "@amina", preview: "sounds perfect! see you there ✨", time: "10:24 AM", online: true, pinned: true, unread: 2 },
  { name: "Ravi", handle: "@ravi", preview: "sent a photo", time: "9:41 AM", pinned: true },
  { name: "Maya", handle: "@maya", preview: "haha that’s wild", time: "Yesterday" },
  { name: "Jordan", handle: "@jordan", preview: "let’s sync tomorrow?", time: "Yesterday" },
  { name: "Taylor", handle: "@taylor", preview: "got it 👍", time: "Mon", unread: 1 },
];

const groups = [
  { name: "Design", preview: "Amina: love this direction", time: "10:12 AM" },
  { name: "Build Club", preview: "Ravi: looking good", time: "Yesterday" },
  { name: "Game Night", preview: "Jordan: who’s in?", time: "Sun" },
];

type Message = { author: string; time: string; body: string; mine?: boolean };
const initialMessages: Message[] = [
  { author: "Amina", time: "9:14 AM", body: "hey! are you still on for the design review today?\nwould love your thoughts on the new direction." },
  { author: "Daniel", time: "9:16 AM", body: "yep! just wrapped up the last round. the updates look great — much cleaner and more focused." },
  { author: "Amina", time: "9:18 AM", body: "awesome! I’ll send over the latest link in a sec.\nthere are a few small tweaks I’m considering." },
  { author: "Daniel", time: "9:21 AM", body: "sounds good. happy to take a look and share feedback.\nwant to hop on a quick call after?" },
  { author: "Amina", time: "10:24 AM", body: "that works! I’ll be free around 2pm. we can go over it then.\nsounds perfect! see you there ✨" },
];

function Avatar({ username, online = false, small = false }: { username: string; online?: boolean; small?: boolean }) {
  return <span className="relative flex shrink-0">
    <ProfileAvatar username={username} size={small ? 32 : 40} />
    {online && <span className="absolute right-0 bottom-0 size-2.5 rounded-full border border-background bg-[#63C58B]" />}
  </span>;
}

export function ChatWorkspace() {
  const [active, setActive] = useState("Amina");
  const [mobileThread, setMobileThread] = useState(true);
  const [query, setQuery] = useState("");
  const [messageQuery, setMessageQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const selected = conversations.find(person => person.name === active) ?? {
    name: active,
    handle: "Group conversation",
    preview: "",
    time: "",
    online: false,
  };
  const visibleConversations = conversations.filter(person => `${person.name} ${person.preview}`.toLowerCase().includes(query.toLowerCase()));
  const visibleMessages = messages.filter(message => message.body.toLowerCase().includes(messageQuery.toLowerCase()));
  const pinnedConversations = visibleConversations.filter(person => person.pinned);
  const recentConversations = visibleConversations.filter(person => !person.pinned);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setMessages(current => [...current, { author: "You", time: "Now", body, mine: true }]);
    setDraft("");
  }

  return (
    <div className="grid h-[calc(100dvh-4rem)] min-h-[580px] grid-cols-1 overflow-hidden lg:grid-cols-[240px_minmax(0,1fr)_240px] xl:grid-cols-[280px_minmax(0,1fr)_270px]">
      <aside aria-label="Conversations" className={`${mobileThread ? "hidden" : "flex"} min-h-0 flex-col border-r border-border lg:flex`}>
        <div className="border-b border-border p-5">
          <h1 className="text-lg font-semibold">Direct messages</h1>
          <p className="mt-1 text-xs leading-5 text-nook-text-muted">Your one-on-one conversations across Nook.</p>
          <label className="flex h-11 items-center gap-2 border border-border bg-nook-surface px-3 text-nook-text-muted focus-within:border-nook-control-border">
            <IconSearch size={17} stroke={1.75} aria-hidden="true" />
            <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search conversations" placeholder="Search conversations..." className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-nook-text-muted" />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-5">
          <div className="flex items-center justify-between px-2 pb-2 pt-4"><h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-nook-text-muted">Pinned <span className="ml-1">— {pinnedConversations.length}</span></h2><button type="button" aria-label="New direct message" className="flex size-8 items-center justify-center text-nook-text-secondary hover:bg-nook-surface-hover"><IconPlus size={18} stroke={1.75} /></button></div>
          <ul className="space-y-1">
            {pinnedConversations.map(person => <li key={person.name}><button type="button" onClick={() => { setActive(person.name); setMobileThread(true); }} aria-current={active === person.name ? "true" : undefined} className={`flex min-h-[66px] w-full items-center gap-3 px-2 text-left transition-colors ${active === person.name ? "border-l-2 border-primary bg-nook-surface-raised" : "hover:bg-nook-surface"}`}>
              <Avatar username={person.handle.slice(1)} online={person.online} small />
              <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-xs font-medium">{person.name} <IconPin className="ml-1 inline text-nook-text-muted" size={12} aria-hidden="true" /></span><span className="shrink-0 text-[10px] text-nook-text-muted">{person.time}</span></span><span className="mt-1 block truncate text-[11px] text-nook-text-secondary">{person.preview}</span></span>
              {person.unread && <span aria-label={`${person.unread} unread messages`} className="grid size-5 place-items-center bg-primary text-[10px] font-medium text-primary-foreground">{person.unread}</span>}
            </button></li>)}
          </ul>
          <div className="mt-6 flex items-center justify-between px-2 pb-2"><h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-nook-text-muted">Recent</h2></div>
          <ul className="space-y-1">{recentConversations.map(person => <li key={person.name}>
            <button type="button" onClick={() => { setActive(person.name); setMobileThread(true); }} aria-current={active === person.name ? "true" : undefined} className={`flex min-h-[66px] w-full items-center gap-3 px-2 text-left ${active === person.name ? "border-l-2 border-primary bg-nook-surface-raised" : "hover:bg-nook-surface"}`}>
              <Avatar username={person.handle.slice(1)} online={person.online} small /><span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className="text-xs font-medium">{person.name}</span><span className="text-[10px] text-nook-text-muted">{person.time}</span></span><span className="mt-1 block truncate text-[11px] text-nook-text-secondary">{person.preview}</span></span>{person.unread && <span className="grid size-5 place-items-center bg-primary text-[10px] font-medium text-primary-foreground">{person.unread}</span>}
            </button>
          </li>)}</ul>
          <div className="mt-8 flex items-center justify-between px-2 pb-2"><h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-nook-text-muted">Groups</h2><button type="button" aria-label="Create a group" className="flex size-8 items-center justify-center text-nook-text-secondary hover:bg-nook-surface-hover"><IconPlus size={18} stroke={1.75} /></button></div>
          <ul className="space-y-1">{groups.map(group => <li key={group.name}>
            <button type="button" onClick={() => { setActive(group.name); setMobileThread(true); }} className="flex min-h-[62px] w-full items-center gap-3 px-2 text-left hover:bg-nook-surface">
              <span className="flex size-8 shrink-0 items-center justify-center bg-nook-surface-raised text-nook-text-secondary"><IconUsers size={17} stroke={1.75} /></span>
              <span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className="text-xs font-medium">{group.name}</span><span className="text-[10px] text-nook-text-muted">{group.time}</span></span><span className="mt-1 block truncate text-[11px] text-nook-text-secondary">{group.preview}</span></span>
            </button>
          </li>)}</ul>
        </div>
      </aside>

      <section aria-label={`${active} conversation`} className={`${mobileThread ? "flex" : "hidden"} min-h-0 min-w-0 flex-col lg:flex`}>
        <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-3 border-b border-border px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMobileThread(false)} aria-label="Back to conversations" className="flex size-9 shrink-0 items-center justify-center text-nook-text-secondary hover:bg-nook-surface lg:hidden"><IconArrowLeft size={19} stroke={1.75} /></button>
            <Avatar username={selected.handle?.slice(1) ?? selected.name} online={selected.online} small />
            <div className="min-w-0"><h1 className="truncate text-sm font-semibold">{active}</h1><p className="flex items-center gap-1.5 text-xs text-nook-text-muted">{selected.online && <span className="size-2 rounded-full bg-nook-success" />} {selected.online ? "Online" : selected.handle ?? "Group conversation"}</p></div>
          </div>
          <div className="flex items-center gap-2"><label className="hidden h-10 min-w-36 items-center gap-2 border border-nook-control-border px-3 text-nook-text-muted md:flex xl:min-w-48"><IconSearch size={16} aria-hidden="true" /><input value={messageQuery} onChange={event => setMessageQuery(event.target.value)} aria-label="Search in conversation" placeholder="Search conversation" className="min-w-0 w-full bg-transparent text-xs text-foreground outline-none placeholder:text-nook-text-muted" /></label><button type="button" aria-label="Conversation options" className="flex size-9 items-center justify-center text-nook-text-secondary hover:bg-nook-surface"><IconDots size={20} stroke={1.75} /></button></div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-8">
          <p className="mb-7 flex items-center gap-3 text-[11px] text-nook-text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">Tue, Apr 22</p>
          <div className="space-y-7">
            {visibleMessages.map((message, index) => <article key={`${message.author}-${index}`} className="flex gap-3">
              <Avatar username={message.author.toLowerCase()} small />
              <div className="min-w-0 flex-1"><div className="flex items-baseline gap-2"><h2 className="text-xs font-medium">{message.author}</h2><time className="text-[10px] text-nook-text-muted">{message.time}</time></div><p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-nook-text-secondary md:text-sm">{message.body}</p></div>
            </article>)}
          </div>
        </div>

        <div className="shrink-0 px-3 pb-3 md:px-5 md:pb-5">
          <form onSubmit={sendMessage} className="flex min-h-14 items-center gap-2 border border-border bg-nook-surface p-2 focus-within:border-nook-control-border">
            <button type="button" aria-label="Attach a file" className="flex size-9 shrink-0 items-center justify-center text-nook-text-secondary hover:text-foreground"><IconPaperclip size={19} stroke={1.75} /></button>
            <label className="sr-only" htmlFor="message-draft">Message {active}</label>
            <input id="message-draft" value={draft} onChange={event => setDraft(event.target.value)} placeholder={`Message ${active}...`} className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-nook-text-muted" />
            <button type="button" aria-label="Add emoji" className="hidden size-9 shrink-0 items-center justify-center text-nook-text-secondary hover:text-foreground sm:flex"><IconMoodSmile size={19} stroke={1.75} /></button>
            <button type="submit" disabled={!draft.trim()} className="flex h-10 shrink-0 items-center gap-2 bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-nook-accent-hover disabled:cursor-not-allowed disabled:opacity-45 md:px-4"><IconSend size={17} stroke={1.75} /><span className="hidden sm:inline">Send</span></button>
          </form>
          <p className="mt-2 text-center text-[10px] text-nook-text-muted">Chat preview · Messages stay on this page.</p>
        </div>
      </section>

      <aside aria-label="Conversation details" className="hidden min-h-0 overflow-y-auto border-l border-border px-5 py-6 lg:block xl:px-6">
        <Avatar username={selected.handle?.slice(1) ?? selected.name} online={selected.online} />
        <h2 className="mt-3 text-lg font-semibold">{active}</h2>
        <p className="text-sm text-nook-text-muted">{selected.handle ?? "Group conversation"}</p>
        <p className="mt-5 text-sm leading-6 text-nook-text-secondary">Product designer building social experiences. Coffee, friends, and better software.</p>
        <div className="mt-5 space-y-3 text-xs text-nook-text-secondary"><p>⌖ &nbsp; San Francisco, CA</p><p>↗ &nbsp; amina.design</p><p>▦ &nbsp; Joined Mar 2023</p></div>
        <div className="my-6 h-px bg-border" />
        <h3 className="text-xs font-semibold">Shared groups <span className="text-nook-text-muted">(1)</span></h3>
        <div className="mt-4 flex items-center gap-3 border border-border p-3"><span className="flex size-9 items-center justify-center bg-nook-surface-raised"><IconUsers size={18} stroke={1.75} /></span><span><span className="block text-xs font-medium">Design</span><span className="text-[11px] text-nook-text-muted">12 members</span></span></div>
        <div className="my-6 h-px bg-border" />
        <h3 className="text-xs font-semibold">Mutual friends <span className="text-nook-text-muted">(3)</span></h3>
        <ul className="mt-4 space-y-4">{conversations.slice(1, 4).map(friend => <li key={friend.name} className="flex items-center gap-3"><Avatar username={friend.handle.slice(1)} small /><span><span className="block text-xs font-medium">{friend.name}</span><span className="text-[11px] text-nook-text-muted">{friend.handle}</span></span></li>)}</ul>
      </aside>
    </div>
  );
}
