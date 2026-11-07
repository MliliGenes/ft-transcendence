"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { IconArrowLeft, IconChevronDown, IconDownload, IconFileTypePdf, IconMessageCircle, IconPaperclip, IconPlus, IconSearch, IconSend, IconSettings, IconUsers, IconX } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/components/auth/auth-provider";
import { AccountAvatar } from "@/components/app/account-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { accountApi, type PublicAccount } from "@/lib/accounts/client";
import { accountImageSource } from "@/lib/accounts/images";
import { chatApi, type AttachmentPreview, type ChatGroup, type ChatMessage } from "@/lib/chat/client";
import { friendshipQueryKey, socialApi } from "@/lib/social/client";
import { GroupManagement } from "@/components/app/group-management";

type Selection = { kind: "dm"; id: string } | { kind: "group"; id: string; groupId: string };
const conversationsKey = (id?: string) => ["chat", "conversations", id] as const;
const groupsKey = (id?: string) => ["chat", "groups", id] as const;
const messagesKey = (userId: string | undefined, channelId: string) => ["chat", "messages", userId, channelId] as const;
const displayName = (user: { displayName: string | null; username: string }) => user.displayName?.trim() || user.username;
const dateTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const maxAttachmentBytes = 10 * 1024 * 1024;
const allowedAttachmentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return typeof message.id === "string" && typeof message.conversationId === "string" &&
    typeof message.authorId === "string" && Boolean(message.author && typeof message.author.id === "string") &&
    (message.content === null || typeof message.content === "string") && Array.isArray(message.attachments) &&
    message.attachments.every(key => typeof key === "string") && typeof message.createdAt === "string" &&
    typeof message.clientRequestId === "string" && typeof message.version === "number";
}

function secureMediaUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("The attachment service returned an unsafe URL.");
  return url.href;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function ChatWorkspace({ initialConversationId }: { initialConversationId?: string }) {
  const { session, isRestoring, requestWithSession, refreshSession } = useAuth();
  const userId = session?.user.id;
  const accessToken = session?.accessToken;
  const expiresIn = session?.expiresIn;
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<Selection | null>(initialConversationId ? { kind: "dm", id: initialConversationId } : null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupRules, setGroupRules] = useState("");
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [showDirectory, setShowDirectory] = useState(!initialConversationId);
  const [sendError, setSendError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState("");
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "reconnecting">("connecting");
  const [presence, setPresence] = useState<Record<string, string>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastReadRef = useRef("");
  const enteredConversationRef = useRef("");
  const nearBottomRef = useRef(true);
  const socketRef = useRef<Socket | null>(null);
  const activityAtRef = useRef(0);
  const uploadKeysRef = useRef(new Map<File, string>());
  const requestIdRef = useRef("");

  function chooseSelection(next: Selection) {
    setSelection(next);
    setDraft("");
    setSelectedFiles([]);
    uploadKeysRef.current.clear();
    requestIdRef.current = "";
    setShowDirectory(false);
  }

  useEffect(() => {
    const update = () => setMobile(window.matchMedia("(max-width: 760px)").matches);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const conversations = useQuery({
    queryKey: conversationsKey(session?.user.id),
    queryFn: () => requestWithSession(token => chatApi.conversations(token)),
    enabled: Boolean(session) && !isRestoring,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const groups = useQuery({
    queryKey: groupsKey(session?.user.id),
    queryFn: () => requestWithSession(token => chatApi.groups(token)),
    enabled: Boolean(session) && !isRestoring,
    refetchInterval: 20000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const people = useQuery({
    queryKey: ["chat", "people", debouncedSearch],
    queryFn: () => accountApi.searchPeople(debouncedSearch, 1, 8),
    enabled: Boolean(session) && !isRestoring && debouncedSearch.length >= 2,
    retry: false,
  });
  const friendships = useQuery({
    queryKey: friendshipQueryKey(session?.user.id),
    queryFn: () => requestWithSession(token => socialApi.getFriendshipState(token)),
    enabled: Boolean(session) && !isRestoring,
    retry: false,
  });

  const selectedDm = selection?.kind === "dm" ? conversations.data?.find(item => item.id === selection.id) : undefined;
  const selectedGroup = selection?.kind === "group" ? groups.data?.find(item => item.id === selection.groupId) : undefined;
  const selectedChannel = selection?.kind === "group" ? selectedGroup?.channels.find(channel => channel.id === selection.id) : undefined;
  const selectedId = selection?.id;
  const recipient = selectedDm && (selectedDm.dmUserA.id === session?.user.id ? selectedDm.dmUserB : selectedDm.dmUserA);
  const selectedName = recipient ? displayName(recipient) : selectedChannel?.name ?? "Choose a conversation";

  const history = useInfiniteQuery({
    queryKey: messagesKey(session?.user.id, selectedId ?? "none"),
    queryFn: ({ pageParam }) => requestWithSession(token => chatApi.messages(selectedId!, token, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.length >= 51 ? lastPage[lastPage.length - 2]?.id : undefined,
    enabled: Boolean(session && selectedId) && !isRestoring,
    refetchInterval: selectedId ? (connectionState === "connected" ? 30000 : 5000) : false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const messages = useMemo(() => {
    const byId = new Map<string, ChatMessage>();
    for (const page of history.data?.pages ?? []) for (const message of page.slice(0, 50)) {
      if (!byId.has(message.id) || (byId.get(message.id)?.version ?? 0) < message.version) byId.set(message.id, message);
    }
    return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  }, [history.data]);
  const latestMessageId = messages[messages.length - 1]?.id;

  useEffect(() => {
    if (!userId || !accessToken || expiresIn === undefined || isRestoring) return;
    let refreshing = false;
    const socket = io(`${window.location.origin}/chat`, {
      path: "/api/chat/socket.io/",
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;
    const onConnect = () => {
      setConnectionState("connected");
      socket.emit("presence:activity");
    };
    const onDisconnect = () => { setConnectionState("reconnecting"); setPresence({}); };
    const onConnectError = async (error: Error) => {
      setConnectionState("reconnecting");
      if (/unauthorized/i.test(error.message) && !refreshing) {
        refreshing = true;
        try { await refreshSession(); } catch { socket.disconnect(); }
        finally { refreshing = false; }
      }
    };
    const onMessage = (payload: unknown) => {
      if (!isChatMessage(payload)) return;
      const key = messagesKey(userId, payload.conversationId);
      queryClient.setQueryData<InfiniteData<ChatMessage[]>>(key, previous => {
        if (!previous) return previous;
        let found = false;
        const pages = previous.pages.map(page => page.map(item => {
          if (item.id !== payload.id && item.clientRequestId !== payload.clientRequestId) return item;
          found = true;
          return item.version > payload.version ? item : payload;
        }));
        if (!found) pages[0] = [...pages[0], payload].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return { ...previous, pages };
      });
      void queryClient.invalidateQueries({ queryKey: conversationsKey(userId) });
      void queryClient.invalidateQueries({ queryKey: groupsKey(userId) });
    };
    const onSnapshot = (payload: unknown) => {
      if (!payload || typeof payload !== "object" || !Array.isArray((payload as { users?: unknown }).users)) return;
      setPresence(Object.fromEntries((payload as { users: { userId: string; status: string }[] }).users.filter(user => typeof user?.userId === "string" && typeof user.status === "string").map(user => [user.userId, user.status])));
    };
    const onPresence = (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const change = payload as { userId?: unknown; status?: unknown };
      if (typeof change.userId === "string" && typeof change.status === "string") setPresence(previous => ({ ...previous, [change.userId as string]: change.status as string }));
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("message:created", onMessage);
    socket.on("presence:snapshot", onSnapshot);
    socket.on("presence:changed", onPresence);
    const refreshTimer = window.setTimeout(() => {
      refreshSession().catch(() => socket.disconnect());
    }, Math.max(1000, (expiresIn - 60) * 1000));
    const activity = () => {
      if (document.visibilityState !== "visible" || Date.now() - activityAtRef.current < 30000) return;
      activityAtRef.current = Date.now();
      socket.emit("presence:activity");
    };
    const activityEvents: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart", "focus"];
    activityEvents.forEach(event => window.addEventListener(event, activity, { passive: true }));
    document.addEventListener("visibilitychange", activity);
    return () => {
      window.clearTimeout(refreshTimer);
      activityEvents.forEach(event => window.removeEventListener(event, activity));
      document.removeEventListener("visibilitychange", activity);
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [userId, accessToken, expiresIn, isRestoring, queryClient, refreshSession]);

  useEffect(() => {
    enteredConversationRef.current = "";
    nearBottomRef.current = true;
    uploadKeysRef.current.clear();
    requestIdRef.current = "";
  }, [selectedId]);

  const openDm = useMutation({
    mutationFn: (userId: string) => requestWithSession(token => chatApi.openDm(userId, token)),
    onSuccess: async conversation => {
      await queryClient.invalidateQueries({ queryKey: conversationsKey(session?.user.id) });
      chooseSelection({ kind: "dm", id: conversation.id });
      setSearch("");
    },
  });
  const createGroup = useMutation({
    mutationFn: ({ name, rules }: { name: string; rules: string }) => requestWithSession(token => chatApi.createGroup(name.trim(), token, rules)),
    onSuccess: async group => {
      await queryClient.invalidateQueries({ queryKey: groupsKey(session?.user.id) });
      const channel = group.channels?.[0];
      if (channel) chooseSelection({ kind: "group", groupId: group.id, id: channel.id });
      setGroupName("");
      setGroupRules("");
      setShowGroupForm(false);
      setShowDirectory(false);
    },
  });
  const sendMessage = useMutation({
    mutationFn: async ({ content, clientRequestId, files }: { content: string; clientRequestId: string; files: File[] }) => requestWithSession(async token => {
      const objectKeys: string[] = [];
      for (const [index, file] of files.entries()) {
        setUploadProgress(`Uploading ${index + 1} of ${files.length}…`);
        let objectKey = uploadKeysRef.current.get(file);
        if (!objectKey) {
          const upload = await chatApi.createAttachmentUpload(selectedId!, file.type, token);
          if (file.size > upload.maxBytes) throw new Error(`${file.name} exceeds the ${Math.floor(upload.maxBytes / 1024 / 1024)} MB limit.`);
          await chatApi.uploadFile(upload, file);
          objectKey = upload.objectKey;
          uploadKeysRef.current.set(file, objectKey);
        }
        objectKeys.push(objectKey);
      }
      setUploadProgress("");
      return chatApi.send(selectedId!, content, clientRequestId, token, objectKeys);
    }),
    onMutate: () => setSendError(""),
    onSuccess: async () => {
      setDraft("");
      setSelectedFiles([]);
      uploadKeysRef.current.clear();
      requestIdRef.current = "";
      setSendError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: messagesKey(session?.user.id, selectedId ?? "") }),
        queryClient.invalidateQueries({ queryKey: conversationsKey(session?.user.id) }),
        queryClient.invalidateQueries({ queryKey: groupsKey(session?.user.id) }),
      ]);
      requestAnimationFrame(() => { const element = scrollContainerRef.current; if (element) element.scrollTop = element.scrollHeight; });
      inputRef.current?.focus();
    },
    onError: error => { setUploadProgress(""); setSendError(errorMessage(error)); },
  });

  useEffect(() => {
    lastReadRef.current = "";
  }, [selectedId]);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest || latest.id === lastReadRef.current || !selection || document.visibilityState !== "visible") return;
    lastReadRef.current = latest.id;
    requestWithSession(token => chatApi.markRead(selection.id, latest.id, token)).then(() => {
      void queryClient.invalidateQueries({ queryKey: conversationsKey(session?.user.id) });
      void queryClient.invalidateQueries({ queryKey: groupsKey(session?.user.id) });
    }).catch(() => { lastReadRef.current = ""; });
  }, [messages, selection, session?.user.id, requestWithSession, queryClient]);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element || !history.isSuccess || !selectedId) return;
    if (enteredConversationRef.current !== selectedId) {
      element.scrollTop = element.scrollHeight;
      enteredConversationRef.current = selectedId;
      nearBottomRef.current = true;
    } else if (latestMessageId && nearBottomRef.current) {
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    }
  }, [history.isSuccess, latestMessageId, selectedId]);

  if (isRestoring) return <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Restoring your session…</div>;
  if (!session) return <section className="grid flex-1 place-items-center p-6"><div className="max-w-sm border border-border p-7 text-center"><IconMessageCircle className="mx-auto size-8 text-primary" aria-hidden="true" /><h1 className="mt-4 text-xl font-semibold">Chat with your people</h1><p className="mt-2 text-sm text-muted-foreground">Sign in to open conversations and join groups.</p><Button render={<a href="/login" />} className="mt-5 min-h-11">Log in</Button></div></section>;

  const sortedConversations = [...(conversations.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const matchedPeople = (people.data?.users ?? []).filter(person => person.id !== session.user.id);
  const directoryVisible = !mobile || showDirectory;
  const threadVisible = !mobile || !showDirectory;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!selectedId || !content || sendMessage.isPending) return;
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    sendMessage.mutate({ content, clientRequestId: requestIdRef.current, files: selectedFiles });
  }

  function personName(person: PublicAccount) { return displayName(person); }

  return (
    <section className="flex h-[calc(100svh-4rem)] min-h-0 flex-1 overflow-hidden" aria-label="Chat workspace">
      {directoryVisible && <aside className={`${mobile ? "w-full" : "w-72 shrink-0 border-r"} flex min-h-0 flex-col border-border bg-card/50`} aria-label="Conversations">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <div><p className="text-xs font-mono uppercase tracking-[0.16em] text-primary">Your space</p><h1 className="text-lg font-semibold">Messages</h1></div>
          <Button variant="outline" size="icon" className="size-11" aria-label="Create a group" title="Create a group" onClick={() => setShowGroupForm(value => !value)}><IconPlus size={19} /></Button>
        </header>
        <div className="border-b border-border p-3">
          <label className="sr-only" htmlFor="chat-search">Find a person</label>
          <div className="relative"><IconSearch aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="chat-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find someone to message" className="h-11 pl-9" autoComplete="off" /></div>
          {search.trim().length >= 2 && <div className="mt-2 max-h-56 overflow-y-auto border border-border bg-background" aria-live="polite">
            {people.isPending && <p className="p-3 text-sm text-muted-foreground">Searching people…</p>}
            {people.isError && <p role="alert" className="p-3 text-sm text-destructive">Could not search people. Try again.</p>}
            {people.isSuccess && matchedPeople.length === 0 && <p className="p-3 text-sm text-muted-foreground">No matching people.</p>}
            {matchedPeople.map(person => <button key={person.id} type="button" onClick={() => openDm.mutate(person.id)} disabled={openDm.isPending} className="flex min-h-14 w-full items-center gap-3 px-3 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
              <AccountAvatar source={accountImageSource(person.avatarUrl)} seed={person.id} label={`${personName(person)} avatar`} size={36} className="size-9 object-cover" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{personName(person)}</span><span className="block truncate text-xs text-muted-foreground">@{person.username}</span></span>
              <IconMessageCircle size={17} className="text-primary" aria-hidden="true" />
            </button>)}
          </div>}
        </div>
        {openDm.error && <p role="alert" className="px-4 py-2 text-xs text-destructive">{errorMessage(openDm.error)}</p>}
        {showGroupForm && <form className="flex gap-2 border-b border-border p-3" onSubmit={event => { event.preventDefault(); if (groupName.trim()) createGroup.mutate({ name: groupName, rules: groupRules }); }}>
          <div className="grid min-w-0 flex-1 gap-2">
            <Input autoFocus aria-label="New group name" value={groupName} maxLength={100} onChange={event => setGroupName(event.target.value)} placeholder="Group name" className="h-10" />
            <Textarea aria-label="Group rules" value={groupRules} maxLength={4000} onChange={event => setGroupRules(event.target.value)} placeholder="Group rules (optional)" className="min-h-16" />
          </div>
          <Button type="submit" size="sm" disabled={!groupName.trim() || createGroup.isPending} className="h-10">Create</Button>
        </form>}
        {(createGroup.error || groups.error || conversations.error) && <div role="alert" className="px-4 py-2 text-xs text-destructive">{errorMessage(createGroup.error ?? groups.error ?? conversations.error)}</div>}
        <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Chat list">
          <div className="px-4 pb-1 pt-4 text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Message a friend</div>
          {friendships.isPending && <p role="status" className="px-4 py-3 text-sm text-muted-foreground">Loading friends…</p>}
          {friendships.error && <div className="px-4 py-3"><p role="alert" className="text-sm text-destructive">Could not load friends.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => void friendships.refetch()}>Try again</Button></div>}
          {friendships.isSuccess && friendships.data.friends.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Your friends will appear here. You can also search for someone above.</p>}
          {friendships.data?.friends.map(friend => <button key={friend.id} type="button" disabled={openDm.isPending} onClick={() => openDm.mutate(friend.id)} aria-label={`Message ${displayName(friend)}`} className="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
            <AccountAvatar source={accountImageSource(friend.avatarUrl)} seed={friend.id} label={`${displayName(friend)} avatar`} size={36} className="size-9 object-cover" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{displayName(friend)}</span><span className="block truncate text-xs text-muted-foreground">@{friend.username}</span></span>
            <IconMessageCircle size={17} className="text-primary" aria-hidden="true" />
          </button>)}
          <div className="px-4 pb-1 pt-4 text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground">Direct messages</div>
          {conversations.isPending && <p className="px-4 py-3 text-sm text-muted-foreground">Loading messages…</p>}
          {conversations.isSuccess && sortedConversations.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Search for someone to start a conversation.</p>}
          {sortedConversations.map(conversation => {
            const user = conversation.dmUserA.id === session.user.id ? conversation.dmUserB : conversation.dmUserA;
            const active = selection?.kind === "dm" && selection.id === conversation.id;
            return <button type="button" key={conversation.id} aria-current={active ? "true" : undefined} onClick={() => chooseSelection({ kind: "dm", id: conversation.id })} className={`flex min-h-14 w-full items-center gap-3 border-l-2 px-3 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring ${active ? "border-primary bg-primary/10" : "border-transparent"}`}>
              <AccountAvatar source={accountImageSource(user.avatarUrl)} seed={user.id} label={`${displayName(user)} avatar`} size={36} className="size-9 object-cover" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName(user)}</span>
              {conversation.unreadCount > 0 && <span className="min-w-5 bg-primary px-1 text-center text-xs font-semibold text-primary-foreground">{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span>}
            </button>;
          })}
          <div className="flex items-center justify-between px-4 pb-1 pt-5 text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground"><span>Groups</span><IconUsers size={14} aria-hidden="true" /></div>
          {groups.isPending && <p className="px-4 py-2 text-sm text-muted-foreground">Loading groups…</p>}
          {groups.isSuccess && groups.data.length === 0 && <p className="px-4 py-2 text-sm text-muted-foreground">Create a group to start a shared space.</p>}
          {(groups.data ?? []).map(group => <GroupDirectoryItem key={group.id} group={group} selected={selection} onSelect={id => chooseSelection({ kind: "group", groupId: group.id, id })} />)}
        </nav>
      </aside>}

      {threadVisible && <main className="flex min-w-0 flex-1 flex-col bg-background">
        {selection && selectedId ? <>
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
            {mobile && <Button variant="ghost" size="icon" className="size-11" aria-label="Back to conversations" onClick={() => setShowDirectory(true)}><IconArrowLeft size={19} /></Button>}
            {recipient && <AccountAvatar source={accountImageSource(recipient.avatarUrl)} seed={recipient.id} label={`${selectedName} avatar`} size={36} className="size-9 object-cover" />}
            <div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{selectedName}</h2><p className="text-xs text-muted-foreground">{recipient ? <><span>@{recipient.username}</span><span className="mx-2" aria-hidden="true">·</span><span className="inline-flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${presence[recipient.id] === "ONLINE" ? "bg-emerald-500" : presence[recipient.id] === "AWAY" ? "bg-amber-500" : "bg-muted-foreground/50"}`} aria-hidden="true" />{presence[recipient.id] === "ONLINE" ? "Online" : presence[recipient.id] === "AWAY" ? "Away" : "Offline"}</span></> : selectedGroup?.name}</p></div>
            <span role="status" aria-label={connectionState === "connected" ? "Chat connected" : "Reconnecting to chat"} className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"><span className={`size-2 rounded-full ${connectionState === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden="true" />{connectionState === "connected" ? "Live" : "Reconnecting"}</span>
            {selectedChannel?.topic && <p className="hidden max-w-64 truncate text-xs text-muted-foreground lg:block">{selectedChannel.topic}</p>}
            {selectedGroup && <Button type="button" variant="outline" size="icon" className="size-10 shrink-0" aria-label="Group settings" title="Group settings" aria-expanded={showGroupSettings} onClick={() => setShowGroupSettings(value => !value)}><IconSettings size={18} aria-hidden="true" /></Button>}
          </header>
          {selectedGroup && showGroupSettings && <GroupManagement
            group={selectedGroup}
            activeChannelId={selection?.kind === "group" ? selection.id : ""}
            onLeave={() => { setSelection(null); setShowDirectory(true); void queryClient.invalidateQueries({ queryKey: groupsKey(session.user.id) }); }}
            onChannelDeleted={() => { const next = selectedGroup.channels.find(channel => channel.id !== selection?.id); if (next) chooseSelection({ kind: "group", groupId: selectedGroup.id, id: next.id }); else setSelection(null); }}
          />}
          <div ref={scrollContainerRef} onScroll={event => { const element = event.currentTarget; nearBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100; }} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-7" aria-label="Messages" aria-live="polite">
            {history.isPending && <p className="mb-4 text-center text-sm text-muted-foreground">Loading conversation…</p>}
            {history.error && <div className="mb-4 border border-border p-4 text-center"><p role="alert" className="text-sm text-destructive">{errorMessage(history.error)}</p><Button variant="outline" className="mt-3 min-h-10" onClick={() => void history.refetch()}>Try again</Button></div>}
            {history.isSuccess && messages.length === 0 && <div className="my-auto text-center"><IconMessageCircle size={32} className="mx-auto text-primary" aria-hidden="true" /><p className="mt-3 font-medium">This is the start of your conversation.</p><p className="mt-1 text-sm text-muted-foreground">Say hello and make it yours.</p></div>}
            {messages.length > 0 && <div className="space-y-5">
              {history.hasNextPage && <Button variant="outline" className="mx-auto flex min-h-10" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>{history.isFetchingNextPage ? "Loading…" : "Load older messages"}</Button>}
              {messages.map(message => <MessageRow key={message.id} message={message} own={message.authorId === session.user.id} />)}
            </div>}
          </div>
          <form className="shrink-0 border-t border-border bg-card/40 p-3 sm:px-5 sm:py-4" onSubmit={submit}>
            {sendError && <p role="alert" className="mb-2 text-sm text-destructive">{sendError}</p>}
            {uploadProgress && <p role="status" className="mb-2 text-sm text-muted-foreground">{uploadProgress}</p>}
            {selectedFiles.length > 0 && <ul className="mb-3 flex flex-wrap gap-2" aria-label="Attachments to send">{selectedFiles.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex max-w-full items-center gap-2 border border-border bg-background px-2 py-1.5 text-xs"><span className="max-w-48 truncate">{file.name}</span><span className="shrink-0 text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" className="grid size-7 shrink-0 place-items-center rounded-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Remove ${file.name}`} disabled={sendMessage.isPending} onClick={() => { setSelectedFiles(previous => previous.filter((_, itemIndex) => itemIndex !== index)); uploadKeysRef.current.delete(file); requestIdRef.current = ""; }}><IconX size={15} aria-hidden="true" /></button></li>)}</ul>}
            <div className="flex items-end gap-2">
              <label className="grid size-12 shrink-0 cursor-pointer place-items-center border border-input bg-background hover:bg-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50" aria-label="Attach images or PDF files"><IconPaperclip size={19} aria-hidden="true" /><input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" multiple disabled={sendMessage.isPending || selectedFiles.length >= 5} onChange={event => { const incoming = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; const combined = [...selectedFiles, ...incoming]; if (combined.length > 5) { setSendError("You can attach up to 5 files per message."); return; } const invalid = combined.find(file => !allowedAttachmentTypes.has(file.type) || file.size > maxAttachmentBytes || file.size === 0); if (invalid) { setSendError(`${invalid.name} must be an image or PDF under 10 MB.`); return; } setSendError(""); setSelectedFiles(combined); requestIdRef.current = ""; }} /></label>
              <Textarea ref={inputRef} value={draft} maxLength={2000} onChange={event => { setDraft(event.target.value); requestIdRef.current = ""; }} disabled={sendMessage.isPending} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={`Message ${selectedName}`} aria-label={`Message ${selectedName}`} className="min-h-12 max-h-36 resize-y bg-background" />
              <Button type="submit" size="icon" aria-label="Send message" title="Send message" className="size-12" disabled={!draft.trim() || sendMessage.isPending}><IconSend size={19} aria-hidden="true" /></Button>
            </div>
            <p className="mt-1 text-right text-[11px] text-muted-foreground">Enter to send · Shift+Enter for a new line · Up to 5 images or PDFs, 10 MB each</p>
          </form>
        </> : <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="max-w-sm"><div className="mx-auto grid size-14 place-items-center border border-primary/30 bg-primary/10 text-primary"><IconMessageCircle size={25} aria-hidden="true" /></div><h2 className="mt-4 text-xl font-semibold">Your conversations, in one place</h2><p className="mt-2 text-sm text-muted-foreground">Pick a conversation, find someone new, or create a group space.</p>{mobile && <Button className="mt-5 min-h-11" onClick={() => setShowDirectory(true)}>Browse messages</Button>}</div>
        </div>}
      </main>}
    </section>
  );
}

function GroupDirectoryItem({ group, selected, onSelect }: { group: ChatGroup; selected: Selection | null; onSelect: (channelId: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  return <div>
    <button type="button" className="flex min-h-12 w-full items-center gap-2 px-4 text-left font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      <IconChevronDown size={15} className={`text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`} aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-sm">{group.name}</span><span className="text-[10px] text-muted-foreground">{group.members?.[0]?.role === "ADMIN" ? "ADMIN" : ""}</span>
    </button>
    {expanded && (group.channels ?? []).map(channel => {
      const active = selected?.kind === "group" && selected.groupId === group.id && selected.id === channel.id;
      return <button type="button" key={channel.id} aria-current={active ? "true" : undefined} onClick={() => onSelect(channel.id)} className={`flex min-h-10 w-full items-center gap-2 border-l-2 py-2 pr-3 pl-10 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring ${active ? "border-primary bg-primary/10 text-foreground" : "border-transparent text-muted-foreground"}`}>
        <span aria-hidden="true" className="font-mono">#</span><span className="min-w-0 flex-1 truncate">{channel.name}</span>{channel.unreadCount > 0 && <span className="bg-primary px-1 text-xs text-primary-foreground">{channel.unreadCount}</span>}
      </button>;
    })}
  </div>;
}

function MessageRow({ message, own }: { message: ChatMessage; own: boolean }) {
  const author = message.author;
  return <article className="group flex gap-3" aria-label={`${displayName(author)} at ${dateTime.format(new Date(message.createdAt))}`}>
    <AccountAvatar source={accountImageSource(author.avatarUrl)} seed={author.id} label={`${displayName(author)} avatar`} size={38} className="mt-0.5 size-[38px] shrink-0 object-cover" />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-x-2"><span className="text-sm font-semibold">{displayName(author)}</span><span className="text-xs text-muted-foreground">@{author.username}</span><time dateTime={message.createdAt} className="text-[11px] text-muted-foreground">{dateTime.format(new Date(message.createdAt))}{message.editedAt ? " · edited" : ""}</time>{own && <span className="sr-only">Your message</span>}</div>
      {message.deletedAt ? <p className="mt-1 text-sm italic text-muted-foreground">Message deleted</p> : message.content && <div className="mt-1 break-words text-sm leading-6 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_code]:border [&_code]:border-border [&_code]:bg-card [&_code]:px-1 [&_code]:font-mono [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-border [&_pre]:bg-card [&_pre]:p-3 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"><ReactMarkdown>{message.content}</ReactMarkdown></div>}
      {message.attachments?.length > 0 && <div className="mt-3 flex flex-wrap gap-3">{message.attachments.map(key => <MessageAttachment key={key} conversationId={message.conversationId} objectKey={key} />)}</div>}
    </div>
  </article>;
}

function MessageAttachment({ conversationId, objectKey }: { conversationId: string; objectKey: string }) {
  const { requestWithSession } = useAuth();
  const [downloadError, setDownloadError] = useState("");
  const query = useQuery<AttachmentPreview>({
    queryKey: ["chat", "attachment-preview", conversationId, objectKey],
    queryFn: async () => {
      const result = await requestWithSession(token => chatApi.previewAttachment(conversationId, objectKey, token));
      return { ...result, previewUrl: result.previewUrl ? secureMediaUrl(result.previewUrl) : null };
    },
    retry: false,
    staleTime: 4 * 60 * 1000,
  });
  async function download() {
    try {
      const result = await requestWithSession(token => chatApi.downloadAttachment(conversationId, objectKey, token));
      window.location.assign(secureMediaUrl(result.url));
    } catch { setDownloadError("Could not download this attachment. Try again."); }
  }
  if (query.isPending) return <div className="grid size-28 place-items-center border border-border bg-card text-xs text-muted-foreground">Loading media…</div>;
  if (query.isError) return <button type="button" onClick={() => void query.refetch()} className="grid size-28 place-items-center border border-border bg-card text-xs text-destructive focus-visible:outline-2 focus-visible:outline-ring">Media unavailable · retry</button>;
  const previewUrl = query.data.previewUrl;
  if (previewUrl && query.data.contentType.startsWith("image/")) return <a href={previewUrl} target="_blank" rel="noreferrer" className="block max-w-full overflow-hidden border border-border bg-card focus-visible:outline-2 focus-visible:outline-ring" aria-label="Open image attachment in a new tab"><Image src={previewUrl} alt="Chat attachment" width={640} height={480} unoptimized className="max-h-80 max-w-full object-contain" /></a>;
  return <div className="flex min-h-16 max-w-xs items-center gap-3 border border-border bg-card px-3 py-2"><IconFileTypePdf size={22} className="shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-sm">PDF attachment</span><Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" onClick={() => { setDownloadError(""); void download(); }} aria-label="Download PDF"><IconDownload size={18} aria-hidden="true" /></Button>{downloadError && <span role="alert" className="text-xs text-destructive">{downloadError}</span>}</div>;
}
