"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { IconArrowDown, IconArrowLeft, IconChevronDown, IconHash, IconLayoutSidebarRight, IconLayoutSidebarRightFilled, IconMessageCircle, IconPaperclip, IconPlus, IconSearch, IconSend, IconSettings, IconUsersGroup, IconX } from "@tabler/icons-react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/components/auth/auth-provider";
import { AccountAvatar } from "@/components/app/account-avatar";
import { CreateGroupDialog } from "@/components/app/chat/create-group-dialog";
import { DirectDetails, GroupDetails, GroupMark } from "@/components/app/chat/details-panel";
import { MessageList } from "@/components/app/chat/message-list";
import { GroupSettingsView, type Section as SettingsSection } from "@/components/app/group-management";
import { EmojiPicker } from "@/components/app/chat/emoji-picker";
import { GroupHome } from "@/components/app/chat/group-home";
import { ChatMarkdown } from "@/components/app/chat/chat-markdown";
import { MarkdownToolbar, applyMarkdownFormat, shortcutFormat, type MarkdownFormat } from "@/components/app/chat/markdown-toolbar";
import { StatusDot, presenceLabel } from "@/components/app/status-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMediaQuery } from "@/hooks/use-media-query";
import { accountApi } from "@/lib/accounts/client";
import { accountImageSource } from "@/lib/accounts/images";
import { accountDisplayName as displayName } from "@/lib/accounts/status-icons";
import { chatApi, type ChatGroup, type ChatMessage } from "@/lib/chat/client";
import { friendshipQueryKey, socialApi } from "@/lib/social/client";

type Selection = { kind: "dm"; id: string } | { kind: "group"; id: string; groupId: string } | { kind: "group-home"; groupId: string };
const conversationsKey = (id?: string) => ["chat", "conversations", id] as const;
const groupsKey = (id?: string) => ["chat", "groups", id] as const;
const messagesKey = (userId: string | undefined, channelId: string) => ["chat", "messages", userId, channelId] as const;
const maxAttachmentBytes = 10 * 1024 * 1024;
const maxVideoBytes = 50 * 1024 * 1024;
const videoAttachmentTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const allowedAttachmentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", ...videoAttachmentTypes]);
const attachmentLimit = (file: File) => videoAttachmentTypes.has(file.type) ? maxVideoBytes : maxAttachmentBytes;
const sectionLabel = "px-4 pb-1.5 pt-5 text-xs font-semibold text-muted-foreground";
const rowFocus = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return typeof message.id === "string" && typeof message.conversationId === "string" &&
    typeof message.authorId === "string" && Boolean(message.author && typeof message.author.id === "string") &&
    (message.content === null || typeof message.content === "string") && Array.isArray(message.attachments) &&
    message.attachments.every(key => typeof key === "string") && typeof message.createdAt === "string" &&
    typeof message.clientRequestId === "string" && typeof message.version === "number";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return <div role="status" aria-label="Loading" className="grid gap-3 px-4 py-2">{Array.from({ length: rows }, (_, index) => <div key={index} className="flex items-center gap-3"><Skeleton className="size-9" /><Skeleton className="h-4 flex-1" /></div>)}</div>;
}

export function ChatWorkspace({ initialConversationId }: { initialConversationId?: string }) {
  const { session, isRestoring, requestWithSession, refreshSession } = useAuth();
  const userId = session?.user.id;
  const accessToken = session?.accessToken;
  const expiresIn = session?.expiresIn;
  const queryClient = useQueryClient();
  const mobile = useIsMobile();
  const wide = useMediaQuery("(min-width: 1280px)");
  const [selection, setSelection] = useState<Selection | null>(initialConversationId ? { kind: "dm", id: initialConversationId } : null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [managedGroupId, setManagedGroupId] = useState<string | null>(null);
  const [managedSection, setManagedSection] = useState<SettingsSection>("overview");
  const [detailsPinned, setDetailsPinned] = useState(true);
  const [detailsSheet, setDetailsSheet] = useState(false);
  const [showDirectory, setShowDirectory] = useState(!initialConversationId);
  const [showJump, setShowJump] = useState(false);
  const [preview, setPreview] = useState(false);
  const [sendError, setSendError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ label: string; percent: number } | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "reconnecting">("connecting");
  const [presence, setPresence] = useState<Record<string, string>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
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
    setSendError("");
    uploadKeysRef.current.clear();
    requestIdRef.current = "";
    setShowDirectory(false);
    setShowJump(false);
    setPreview(false);
    setManagedGroupId(null);
  }

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
  const selectedGroup = selection?.kind === "group" || selection?.kind === "group-home" ? groups.data?.find(item => item.id === selection.groupId) : undefined;
  const selectedChannel = selection?.kind === "group" ? selectedGroup?.channels.find(channel => channel.id === selection.id) : undefined;
  const managedGroup = managedGroupId ? groups.data?.find(item => item.id === managedGroupId) : undefined;
  const selectedId = selection && selection.kind !== "group-home" ? selection.id : undefined;
  const recipient = selectedDm && (selectedDm.dmUserA.id === session?.user.id ? selectedDm.dmUserB : selectedDm.dmUserA);
  const selectedName = recipient ? displayName(recipient) : selectedChannel ? `#${selectedChannel.name}` : "Choose a conversation";

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
    lastReadRef.current = "";
  }, [selectedId]);

  const openDm = useMutation({
    mutationFn: (userId: string) => requestWithSession(token => chatApi.openDm(userId, token)),
    onSuccess: async conversation => {
      await queryClient.invalidateQueries({ queryKey: conversationsKey(session?.user.id) });
      chooseSelection({ kind: "dm", id: conversation.id });
      setSearch("");
    },
  });
  const sendMessage = useMutation({
    mutationFn: async ({ content, clientRequestId, files }: { content: string; clientRequestId: string; files: File[] }) => requestWithSession(async token => {
      const objectKeys: string[] = [];
      // Overall progress is measured in bytes across every file in this send.
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0) || 1;
      let doneBytes = 0;
      for (const [index, file] of files.entries()) {
        const label = files.length > 1 ? `Uploading ${index + 1} of ${files.length}` : `Uploading ${file.name}`;
        let objectKey = uploadKeysRef.current.get(file);
        if (!objectKey) {
          setUploadProgress({ label, percent: Math.round((doneBytes / totalBytes) * 100) });
          const upload = await chatApi.createAttachmentUpload(selectedId!, file.type, token);
          if (file.size > upload.maxBytes) throw new Error(`${file.name} exceeds the ${Math.floor(upload.maxBytes / 1024 / 1024)} MB limit.`);
          await chatApi.uploadFile(upload, file, loaded => {
            setUploadProgress({ label, percent: Math.min(100, Math.round(((doneBytes + loaded) / totalBytes) * 100)) });
          });
          objectKey = upload.objectKey;
          uploadKeysRef.current.set(file, objectKey);
        }
        doneBytes += file.size;
        objectKeys.push(objectKey);
      }
      setUploadProgress(null);
      return chatApi.send(selectedId!, content, clientRequestId, token, objectKeys);
    }),
    onMutate: () => setSendError(""),
    onSuccess: async () => {
      setDraft("");
      setPreview(false);
      setSelectedFiles([]);
      uploadKeysRef.current.clear();
      requestIdRef.current = "";
      setSendError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: messagesKey(session?.user.id, selectedId ?? "") }),
        queryClient.invalidateQueries({ queryKey: conversationsKey(session?.user.id) }),
        queryClient.invalidateQueries({ queryKey: groupsKey(session?.user.id) }),
      ]);
      nearBottomRef.current = true;
      setShowJump(false);
      requestAnimationFrame(() => { const element = scrollContainerRef.current; if (element) element.scrollTop = element.scrollHeight; });
      inputRef.current?.focus();
    },
    onError: error => { setUploadProgress(null); setSendError(errorMessage(error)); },
  });

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest || latest.id === lastReadRef.current || !selectedId || document.visibilityState !== "visible") return;
    lastReadRef.current = latest.id;
    requestWithSession(token => chatApi.markRead(selectedId, latest.id, token)).then(() => {
      void queryClient.invalidateQueries({ queryKey: conversationsKey(session?.user.id) });
      void queryClient.invalidateQueries({ queryKey: groupsKey(session?.user.id) });
    }).catch(() => { lastReadRef.current = ""; });
  }, [messages, selectedId, session?.user.id, requestWithSession, queryClient]);

  // Opening a conversation always lands on the present (latest message).
  useLayoutEffect(() => {
    const element = scrollContainerRef.current;
    if (!element || !history.isSuccess || !selectedId || enteredConversationRef.current === selectedId) return;
    enteredConversationRef.current = selectedId;
    nearBottomRef.current = true;
    element.scrollTop = element.scrollHeight;
  }, [history.isSuccess, selectedId]);

  // Stick to the bottom while the reader is there: new messages, late-loading images and
  // attachment previews all change the content height after the first scroll.
  useEffect(() => {
    const element = scrollContainerRef.current;
    const content = contentRef.current;
    if (!element || !content) return;
    const observer = new ResizeObserver(() => {
      if (nearBottomRef.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(content);
    observer.observe(element);
    return () => observer.disconnect();
  }, [selectedId, latestMessageId]);

  if (isRestoring) return <div role="status" className="grid flex-1 place-items-center text-sm text-muted-foreground">Restoring your session…</div>;
  if (!session) return <section className="grid flex-1 place-items-center p-6"><div className="max-w-sm bg-card p-8 text-center"><IconMessageCircle className="mx-auto size-8 text-primary" aria-hidden="true" /><h1 className="mt-4 text-xl font-semibold">Chat with your people</h1><p className="mt-2 text-sm text-muted-foreground">Sign in to open conversations and join groups.</p><Button render={<Link href="/login" />} className="mt-5 min-h-11 px-5">Log in</Button></div></section>;

  const sortedConversations = [...(conversations.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const matchedPeople = (people.data?.users ?? []).filter(person => person.id !== session.user.id);
  const friends = friendships.data?.friends ?? [];
  const directoryVisible = !mobile || showDirectory;
  const threadVisible = !mobile || !showDirectory;
  const detailsInline = wide && detailsPinned && Boolean(selectedId) && !managedGroup;
  const isGroupAdmin = selectedGroup?.members?.[0]?.role === "ADMIN";
  const detailsContent = selection ? (recipient
    ? <DirectDetails key={recipient.id} user={recipient} presence={presence[recipient.id]} />
    : selectedGroup && selection.kind === "group" ? <GroupDetails key={selectedGroup.id} group={selectedGroup} channel={selectedChannel} presence={presence} onManage={() => { setDetailsSheet(false); openSettings(selectedGroup.id); }} onLeft={() => { setDetailsSheet(false); setSelection(null); setShowDirectory(true); }} />
      : null) : null;

  function openSettings(groupId: string, section: SettingsSection = "overview") {
    setManagedSection(section);
    setManagedGroupId(groupId);
    setShowDirectory(false);
  }

  function insertText(text: string) {
    const element = inputRef.current;
    const start = element?.selectionStart ?? draft.length;
    const end = element?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + text + draft.slice(end);
    if (next.length > 2000) return;
    setDraft(next);
    setPreview(false);
    requestIdRef.current = "";
    requestAnimationFrame(() => { const input = inputRef.current; if (input) { input.focus(); input.setSelectionRange(start + text.length, start + text.length); } });
  }

  function toggleDetails() {
    if (wide) setDetailsPinned(value => !value);
    else setDetailsSheet(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!selectedId || !content || sendMessage.isPending) return;
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    sendMessage.mutate({ content, clientRequestId: requestIdRef.current, files: selectedFiles });
  }

  function applyFormat(kind: MarkdownFormat) {
    const element = inputRef.current;
    if (!element) return;
    const next = applyMarkdownFormat(draft, element.selectionStart, element.selectionEnd, kind);
    if (next.value.length > 2000) return;
    setDraft(next.value);
    requestIdRef.current = "";
    requestAnimationFrame(() => { element.focus(); element.setSelectionRange(next.start, next.end); });
  }

  function jumpToLatest() {
    const element = scrollContainerRef.current;
    if (!element) return;
    nearBottomRef.current = true;
    setShowJump(false);
    element.scrollTo({ top: element.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  return (
    <section className="flex h-[calc(100svh-4rem)] min-h-0 flex-none overflow-hidden" aria-label="Chat workspace">
      {directoryVisible && <aside className={`${mobile ? "w-full" : "w-72 shrink-0 border-r"} flex min-h-0 flex-col border-border bg-card`} aria-label="Conversations">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <h1 className="text-lg font-semibold tracking-tight">Messages</h1>
          <Button variant="ghost" size="icon" className="size-11" aria-label="Create a group" title="Create a group" onClick={() => setShowCreateGroup(true)}><IconPlus size={20} aria-hidden="true" /></Button>
        </header>
        <div className="relative border-b border-border p-3">
          <label className="sr-only" htmlFor="chat-search">Find a person</label>
          <div className="relative"><IconSearch aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="chat-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find or start a conversation" className="h-11 bg-background pl-9" autoComplete="off" /></div>
          {search.trim().length >= 2 && <div className="mt-2 max-h-64 overflow-y-auto border border-border bg-background" aria-live="polite">
            {(people.isPending || debouncedSearch !== search.trim()) && <p role="status" className="p-3 text-sm text-muted-foreground">Searching people…</p>}
            {people.isError && <p role="alert" className="p-3 text-sm text-destructive">Could not search people. Try again.</p>}
            {people.isSuccess && debouncedSearch === search.trim() && matchedPeople.length === 0 && <p className="p-3 text-sm text-muted-foreground">No one matches “{search.trim()}”.</p>}
            {matchedPeople.map(person => <button key={person.id} type="button" onClick={() => openDm.mutate(person.id)} disabled={openDm.isPending} className={`flex min-h-14 w-full items-center gap-3 px-3 text-left hover:bg-muted disabled:opacity-50 ${rowFocus}`}>
              <AccountAvatar source={accountImageSource(person.avatarUrl)} seed={person.id} label={`${displayName(person)} avatar`} size={36} className="size-9 object-cover" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{displayName(person)}</span><span className="block truncate text-xs text-muted-foreground">@{person.username}</span></span>
              <IconMessageCircle size={17} className="text-muted-foreground" aria-hidden="true" />
            </button>)}
          </div>}
        </div>
        {openDm.error && <p role="alert" className="px-4 py-2 text-xs text-destructive">{errorMessage(openDm.error)}</p>}
        {(groups.error || conversations.error) && <div role="alert" className="px-4 py-2 text-xs text-destructive">{errorMessage(groups.error ?? conversations.error)}</div>}

        <nav className="min-h-0 flex-1 overflow-y-auto pb-4" aria-label="Chat list">
          {(friendships.isPending || friends.length > 0 || friendships.isError) && <>
            <h2 className={sectionLabel}>Friends</h2>
            {friendships.isPending && <div className="flex gap-3 px-4">{[0, 1, 2, 3].map(item => <Skeleton key={item} className="size-11" />)}</div>}
            {friendships.isError && <div className="px-4"><p role="alert" className="text-sm text-destructive">Could not load friends.</p><Button variant="outline" className="mt-2 min-h-10" onClick={() => void friendships.refetch()}>Try again</Button></div>}
            {friends.length > 0 && <ul className="flex gap-1 overflow-x-auto px-3 pb-1">{friends.map(friend => <li key={friend.id} className="shrink-0">
              <button type="button" disabled={openDm.isPending} onClick={() => openDm.mutate(friend.id)} aria-label={`Message ${displayName(friend)}, ${presenceLabel(presence[friend.id])}`} title={displayName(friend)} className={`flex w-16 flex-col items-center gap-1 p-1.5 hover:bg-muted disabled:opacity-50 ${rowFocus}`}>
                <span className="relative"><AccountAvatar source={accountImageSource(friend.avatarUrl)} seed={friend.id} label="" size={44} className="size-11 object-cover" /><StatusDot status={presence[friend.id]} ring className="absolute -right-0.5 -bottom-0.5" /></span>
                <span className="w-full truncate text-center text-[11px] text-muted-foreground">{displayName(friend)}</span>
              </button>
            </li>)}</ul>}
          </>}

          <h2 className={sectionLabel}>Direct messages</h2>
          {conversations.isPending && <ListSkeleton />}
          {conversations.isSuccess && sortedConversations.length === 0 && <p className="px-4 py-2 text-sm text-muted-foreground">No conversations yet. Search above or pick a friend to say hello.</p>}
          <ul>{sortedConversations.map(conversation => {
            const user = conversation.dmUserA.id === session.user.id ? conversation.dmUserB : conversation.dmUserA;
            const active = selection?.kind === "dm" && selection.id === conversation.id;
            const unread = conversation.unreadCount > 0;
            return <li key={conversation.id}><button type="button" aria-current={active ? "true" : undefined} onClick={() => chooseSelection({ kind: "dm", id: conversation.id })} className={`relative flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-muted ${rowFocus} ${active ? "bg-muted before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-primary" : ""}`}>
              <span className="relative shrink-0"><AccountAvatar source={accountImageSource(user.avatarUrl)} seed={user.id} label="" size={36} className="size-9 object-cover" /><StatusDot status={presence[user.id]} ring className="absolute -right-0.5 -bottom-0.5" /></span>
              <span className="min-w-0 flex-1"><span className={`block truncate text-sm ${unread || active ? "font-semibold text-foreground" : "font-medium text-foreground/85"}`}>{displayName(user)}</span><span className="block truncate text-xs text-muted-foreground">{presence[user.id] === "ONLINE" || presence[user.id] === "AWAY" ? presenceLabel(presence[user.id]) : `@${user.username}`}</span></span>
              {unread && <span className="min-w-5 rounded-md bg-primary px-1.5 py-0.5 text-center shadow-glow-sm text-xs font-semibold text-primary-foreground tabular-nums" aria-label={`${conversation.unreadCount} unread`}>{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span>}
            </button></li>;
          })}</ul>

          <h2 className={`${sectionLabel} flex items-center justify-between`}><span>Groups</span><button type="button" onClick={() => setShowCreateGroup(true)} className={`grid size-7 place-items-center text-muted-foreground hover:text-foreground ${rowFocus}`} aria-label="Create a group"><IconPlus size={15} aria-hidden="true" /></button></h2>
          {groups.isPending && <ListSkeleton rows={2} />}
          {groups.isSuccess && groups.data.length === 0 && <div className="mx-4 mt-1 bg-background p-4"><p className="text-sm font-medium">No groups yet</p><p className="mt-1 text-sm text-muted-foreground">Create a shared space with channels for your people.</p><Button variant="outline" className="mt-3 min-h-10" onClick={() => setShowCreateGroup(true)}><IconUsersGroup size={16} aria-hidden="true" />Create a group</Button></div>}
          {(groups.data ?? []).map(group => <GroupDirectoryItem key={group.id} group={group} selected={selection} onSelect={id => chooseSelection({ kind: "group", groupId: group.id, id })} onOpenHome={() => chooseSelection({ kind: "group-home", groupId: group.id })} />)}
        </nav>
      </aside>}

      {threadVisible && <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        {managedGroup ? <GroupSettingsView
          key={`${managedGroup.id}:${managedSection}`}
          group={managedGroup}
          initialSection={managedSection}
          activeChannelId={selection?.kind === "group" ? selection.id : ""}
          onClose={() => setManagedGroupId(null)}
          onChannelDeleted={() => { const next = managedGroup.channels.find(channel => channel.id !== selectedId); setSelection(next ? { kind: "group", groupId: managedGroup.id, id: next.id } : { kind: "group-home", groupId: managedGroup.id }); }}
        /> : selection?.kind === "group-home" && selectedGroup ? <GroupHome
          key={selectedGroup.id}
          group={selectedGroup}
          presence={presence}
          showBack={mobile}
          onBack={() => setShowDirectory(true)}
          onOpenChannel={channelId => chooseSelection({ kind: "group", groupId: selectedGroup.id, id: channelId })}
          onManage={section => openSettings(selectedGroup.id, section)}
          onLeft={() => { setSelection(null); setShowDirectory(true); }}
        /> : selection && selectedId ? <>
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
            {mobile && <Button variant="ghost" size="icon" className="size-11" aria-label="Back to conversations" onClick={() => setShowDirectory(true)}><IconArrowLeft size={20} aria-hidden="true" /></Button>}
            {recipient
              ? <span className="relative shrink-0"><AccountAvatar source={accountImageSource(recipient.avatarUrl)} seed={recipient.id} label="" size={36} className="size-9 object-cover" /><StatusDot status={presence[recipient.id]} ring className="absolute -right-0.5 -bottom-0.5 ring-background" /></span>
              : <IconHash size={22} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold">{recipient ? selectedName : selectedChannel?.name ?? "Channel"}</h2>
              <p className="truncate text-xs text-muted-foreground">{recipient ? <>{presenceLabel(presence[recipient.id])}<span className="mx-1.5" aria-hidden="true">·</span>@{recipient.username}</> : <>{selectedGroup && <button type="button" onClick={() => chooseSelection({ kind: "group-home", groupId: selectedGroup.id })} className="hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring">{selectedGroup.name}</button>}{selectedChannel?.topic && <><span className="mx-1.5" aria-hidden="true">·</span>{selectedChannel.topic}</>}</>}</p>
            </div>
            {connectionState !== "connected" && <span role="status" className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex"><StatusDot status="AWAY" />{connectionState === "connecting" ? "Connecting…" : "Reconnecting…"}</span>}
            {connectionState === "connected" && <span className="sr-only" role="status">Chat connected</span>}
            {isGroupAdmin && selectedGroup && <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Manage group" title="Manage group" onClick={() => openSettings(selectedGroup.id)}><IconSettings size={20} aria-hidden="true" /></Button>}
            <Button type="button" variant="ghost" size="icon" className={`size-11 shrink-0 ${detailsInline ? "text-foreground" : "text-muted-foreground"}`} aria-label={recipient ? "Show profile panel" : "Show group panel"} aria-pressed={wide ? detailsInline : undefined} title={recipient ? "Profile" : "Group info"} onClick={toggleDetails}>
              {detailsInline ? <IconLayoutSidebarRightFilled size={20} aria-hidden="true" /> : <IconLayoutSidebarRight size={20} aria-hidden="true" />}
            </Button>
          </header>

          <div ref={scrollContainerRef} onScroll={event => { const element = event.currentTarget; const near = element.scrollHeight - element.scrollTop - element.clientHeight < 120; nearBottomRef.current = near; if (near === showJump) setShowJump(!near); }} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 sm:px-6" aria-label="Messages" aria-live="polite">
            <div ref={contentRef} className="mt-auto flex flex-col">
            {history.isPending && <div role="status" aria-label="Loading conversation" className="mt-auto grid gap-5">{[0, 1, 2].map(item => <div key={item} className="flex gap-3"><Skeleton className="size-10 shrink-0" /><div className="grid flex-1 gap-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-3/4" /></div></div>)}</div>}
            {history.error && <div className="m-auto max-w-sm bg-card p-5 text-center"><p role="alert" className="text-sm text-destructive">{errorMessage(history.error)}</p><Button variant="outline" className="mt-3 min-h-10" onClick={() => void history.refetch()}>Try again</Button></div>}
            {history.isSuccess && <div className="mt-auto">
              {history.hasNextPage
                ? <Button variant="ghost" className="mx-auto mb-4 flex min-h-10 text-muted-foreground" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>{history.isFetchingNextPage ? "Loading…" : "Load older messages"}</Button>
                : <ConversationStart recipient={recipient} channelName={selectedChannel?.name} groupName={selectedGroup?.name} />}
              <MessageList messages={messages} currentUserId={session.user.id} />
            </div>}
            </div>
          </div>

          {showJump && <Button variant="secondary" className="absolute bottom-32 left-1/2 z-10 min-h-10 -translate-x-1/2 px-4 shadow-md" onClick={jumpToLatest}><IconArrowDown size={16} aria-hidden="true" />Jump to present</Button>}

          <form className="shrink-0 px-3 pb-3 sm:px-6 sm:pb-4" onSubmit={submit}>
            {sendError && <p role="alert" className="mb-2 text-sm text-destructive">{sendError}</p>}
            {uploadProgress && (
              <div className="mb-2 space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="truncate" aria-hidden="true">{uploadProgress.label}</span>
                  <span className="shrink-0 tabular-nums" aria-hidden="true">{uploadProgress.percent}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={uploadProgress.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploadProgress.percent}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-nook-accent shadow-glow-sm transition-[width] duration-150 ease-out motion-reduce:transition-none" style={{ width: `${uploadProgress.percent}%` }} />
                </div>
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-input bg-card transition-shadow focus-within:border-ring focus-within:shadow-glow-focus motion-reduce:transition-none">
              <MarkdownToolbar controlsId="chat-composer" onFormat={applyFormat} disabled={sendMessage.isPending} preview={preview} onPreviewChange={next => { setPreview(next); if (!next) requestAnimationFrame(() => inputRef.current?.focus()); }} />
              {selectedFiles.length > 0 && <ul className="flex flex-wrap gap-2 border-b border-border p-2" aria-label="Attachments to send">{selectedFiles.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex max-w-full items-center gap-2 bg-background py-1 pr-1 pl-2.5 text-xs"><IconPaperclip size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" /><span className="max-w-48 truncate">{file.name}</span><span className="shrink-0 text-muted-foreground tabular-nums">{(file.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" className={`grid size-7 shrink-0 place-items-center hover:bg-muted ${rowFocus}`} aria-label={`Remove ${file.name}`} disabled={sendMessage.isPending} onClick={() => { setSelectedFiles(previous => previous.filter((_, itemIndex) => itemIndex !== index)); uploadKeysRef.current.delete(file); requestIdRef.current = ""; }}><IconX size={14} aria-hidden="true" /></button></li>)}</ul>}
              <div className="flex items-end gap-1 p-1.5">
                <label className="grid size-11 shrink-0 cursor-pointer place-items-center text-muted-foreground hover:bg-muted hover:text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring" title="Attach images or PDFs">
                  <IconPaperclip size={20} aria-hidden="true" /><span className="sr-only">Attach images or PDF files</span>
                  <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/webm,video/quicktime" multiple disabled={sendMessage.isPending || selectedFiles.length >= 5} onChange={event => { const incoming = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; const combined = [...selectedFiles, ...incoming]; if (combined.length > 5) { setSendError("You can attach up to 5 files per message."); return; } const invalid = combined.find(file => !allowedAttachmentTypes.has(file.type) || file.size > attachmentLimit(file) || file.size === 0); if (invalid) { setSendError(videoAttachmentTypes.has(invalid.type) ? `${invalid.name} must be under 50 MB.` : `${invalid.name} must be an image, PDF or MP4/WebM/MOV video (images and PDFs under 10 MB, videos under 50 MB).`); return; } setSendError(""); setSelectedFiles(combined); requestIdRef.current = ""; }} />
                </label>
                {preview ? <div id="chat-composer-preview" className="max-h-40 min-h-11 min-w-0 flex-1 overflow-y-auto px-3 py-2.5" aria-label="Message preview">{draft.trim() ? <ChatMarkdown>{draft}</ChatMarkdown> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}</div> : <Textarea id="chat-composer" ref={inputRef} value={draft} maxLength={2000} rows={1} onChange={event => { setDraft(event.target.value); requestIdRef.current = ""; }} disabled={sendMessage.isPending} onKeyDown={event => { const shortcut = shortcutFormat(event); if (shortcut) { event.preventDefault(); applyFormat(shortcut); return; } if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={`Message ${selectedName}`} aria-label={`Message ${selectedName}`} aria-describedby="composer-hint" className="field-sizing-content max-h-40 min-h-11 resize-none border-0 bg-transparent py-2.5 focus-visible:ring-0" />}
                <EmojiPicker onSelect={insertText} disabled={sendMessage.isPending} />
                <Button type="submit" size="icon" aria-label="Send message" title="Send message" className="size-11" disabled={!draft.trim() || sendMessage.isPending}><IconSend size={19} aria-hidden="true" /></Button>
              </div>
            </div>
            <p id="composer-hint" className="mt-1.5 hidden text-right text-[11px] text-muted-foreground sm:block">Enter to send · Shift + Enter for a new line · Markdown supported · {draft.length > 1800 ? <span className="tabular-nums text-nook-warning">{2000 - draft.length} characters left</span> : "Up to 5 images or PDFs"}</p>
          </form>
        </> : <div className="grid flex-1 place-items-center p-6 text-center">
          <div className="max-w-sm">
            <div className="mx-auto grid size-16 place-items-center bg-nook-accent-subtle text-primary"><IconMessageCircle size={28} aria-hidden="true" /></div>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">Your conversations, in one place</h2>
            <p className="mt-2 text-sm text-muted-foreground">Pick a conversation, message a friend, or start a group with its own channels.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {mobile && <Button className="min-h-11 px-5" onClick={() => setShowDirectory(true)}>Browse messages</Button>}
              <Button variant="outline" className="min-h-11 px-4" onClick={() => setShowCreateGroup(true)}><IconUsersGroup size={17} aria-hidden="true" />Create a group</Button>
            </div>
          </div>
        </div>}
      </div>}

      {detailsInline && detailsContent && <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-card" aria-label={recipient ? "Profile" : "Group details"}>{detailsContent}</aside>}
      {!wide && <Sheet open={detailsSheet && Boolean(detailsContent)} onOpenChange={setDetailsSheet}>
        <SheetContent side="right" className="w-[22rem] max-w-[90vw] gap-0 overflow-y-auto bg-card p-0">
          <SheetTitle className="sr-only">{recipient ? `${selectedName} profile` : "Group details"}</SheetTitle>
          <SheetDescription className="sr-only">{recipient ? "Profile details for this conversation." : "Channel, rules and members."}</SheetDescription>
          {detailsContent}
        </SheetContent>
      </Sheet>}

      <CreateGroupDialog open={showCreateGroup} onOpenChange={setShowCreateGroup} onCreated={async group => {
        await queryClient.invalidateQueries({ queryKey: groupsKey(session.user.id) });
        chooseSelection({ kind: "group-home", groupId: group.id });
      }} />
    </section>
  );
}

function ConversationStart({ recipient, channelName, groupName }: { recipient?: { id: string; username: string; displayName: string | null; avatarUrl: string | null }; channelName?: string; groupName?: string }) {
  if (recipient) {
    const name = displayName(recipient);
    return <div className="mb-6 pt-6">
      <AccountAvatar source={accountImageSource(recipient.avatarUrl)} seed={recipient.id} label={`${name} avatar`} size={72} className="size-18 object-cover" />
      <h3 className="mt-3 text-2xl font-semibold tracking-tight">{name}</h3>
      <p className="text-sm text-muted-foreground">@{recipient.username}</p>
      <p className="mt-3 text-sm text-muted-foreground">This is the beginning of your conversation with <span className="font-medium text-foreground">{name}</span>.</p>
    </div>;
  }
  return <div className="mb-6 pt-6">
    <div className="grid size-16 place-items-center bg-muted"><IconHash size={32} aria-hidden="true" /></div>
    <h3 className="mt-3 text-2xl font-semibold tracking-tight">Welcome to #{channelName ?? "channel"}</h3>
    <p className="mt-1 text-sm text-muted-foreground">This is the start of the #{channelName} channel{groupName ? <> in <span className="font-medium text-foreground">{groupName}</span></> : null}.</p>
  </div>;
}

function GroupDirectoryItem({ group, selected, onSelect, onOpenHome }: { group: ChatGroup; selected: Selection | null; onSelect: (channelId: string) => void; onOpenHome: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const unread = (group.channels ?? []).reduce((total, channel) => total + channel.unreadCount, 0);
  const homeActive = selected?.kind === "group-home" && selected.groupId === group.id;
  return <div className="mt-0.5">
    <div className={`relative flex items-center hover:bg-muted ${homeActive ? "bg-muted before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:bg-primary" : ""}`}>
      <button type="button" aria-current={homeActive ? "true" : undefined} title={`${group.name} overview`} className={`flex min-h-12 min-w-0 flex-1 items-center gap-2.5 pl-4 text-left ${rowFocus}`} onClick={onOpenHome}>
        <GroupMark name={group.name} className="size-8 text-xs" />
        <span className={`min-w-0 flex-1 truncate text-sm ${homeActive ? "font-semibold" : "font-medium"}`}>{group.name}</span>
        {!expanded && unread > 0 && <span className="size-2 shrink-0 rounded-full bg-primary shadow-glow-sm" aria-label={`${unread} unread`} />}
      </button>
      <button type="button" className={`grid size-11 shrink-0 place-items-center text-muted-foreground hover:text-foreground ${rowFocus}`} aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} ${group.name} channels`} onClick={() => setExpanded(value => !value)}>
        <IconChevronDown size={15} className={`transition-transform ${expanded ? "" : "-rotate-90"}`} aria-hidden="true" />
      </button>
    </div>
    {expanded && <ul>{(group.channels ?? []).map(channel => {
      const active = selected?.kind === "group" && selected.groupId === group.id && selected.id === channel.id;
      const hasUnread = channel.unreadCount > 0;
      return <li key={channel.id}><button type="button" aria-current={active ? "true" : undefined} onClick={() => onSelect(channel.id)} className={`relative flex min-h-10 w-full items-center gap-2 py-2 pr-4 pl-10 text-left text-sm hover:bg-muted hover:text-foreground ${rowFocus} ${active ? "bg-muted font-medium text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:bg-primary" : hasUnread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
        <IconHash size={16} className="shrink-0 opacity-70" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{channel.name}</span>{hasUnread && <span className="min-w-5 rounded-md bg-primary px-1.5 text-center shadow-glow-sm text-xs font-semibold text-primary-foreground tabular-nums" aria-label={`${channel.unreadCount} unread`}>{channel.unreadCount > 99 ? "99+" : channel.unreadCount}</span>}
      </button></li>;
    })}</ul>}
  </div>;
}
