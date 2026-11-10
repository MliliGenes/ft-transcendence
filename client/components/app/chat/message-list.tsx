"use client";

import { Fragment, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { IconDeviceGamepad2, IconDownload, IconFileTypePdf } from "@tabler/icons-react";
import { useAuth } from "@/components/auth/auth-provider";
import { ChatMarkdown } from "@/components/app/chat/chat-markdown";
import { DeleteMessageDialog, MessageEditor, MessageOwnerActions } from "@/components/app/chat/message-actions";
import { AccountAvatar } from "@/components/app/account-avatar";
import { Button } from "@/components/ui/button";
import { accountImageSource } from "@/lib/accounts/images";
import { accountDisplayName } from "@/lib/accounts/status-icons";
import { chatApi, type AttachmentPreview, type ChatMessage } from "@/lib/chat/client";
import { parseCodeArenaInvite } from "@/lib/arena/invitations";
import { LobbyClient } from "@/lib/arena/lobby";

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const fullFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" });
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
const dayWithYearFormat = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" });
const groupWindowMs = 5 * 60 * 1000;

export function secureMediaUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("The attachment service returned an unsafe URL.");
  return url.href;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return "Today";
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";
  return date.getFullYear() === today.getFullYear() ? dayFormat.format(date) : dayWithYearFormat.format(date);
}

/** Messages grouped by author and time, with day dividers, as the design system asks ("avoid boxing every message"). */
export function MessageList({ messages, currentUserId, readReceipt }: {
  messages: ChatMessage[];
  currentUserId: string;
  readReceipt?: { messageId: string; readerCount: number } | null;
}) {
  return <ol className="flex flex-col" aria-label="Message history">
    {messages.map((message, index) => {
      const previous = messages[index - 1];
      const date = new Date(message.createdAt);
      const newDay = !previous || dayKey(new Date(previous.createdAt)) !== dayKey(date);
      const continued = !newDay && previous.authorId === message.authorId && date.getTime() - new Date(previous.createdAt).getTime() < groupWindowMs;
      return <Fragment key={message.id}>
        {newDay && <li role="separator" aria-label={dayLabel(date)} className="my-4 flex items-center gap-3 text-xs font-medium text-muted-foreground first:mt-0">
          <span className="h-px flex-1 bg-border" aria-hidden="true" /><span>{dayLabel(date)}</span><span className="h-px flex-1 bg-border" aria-hidden="true" />
        </li>}
        <MessageRow message={message} own={message.authorId === currentUserId} continued={continued} readerCount={readReceipt?.messageId === message.id ? readReceipt.readerCount : undefined} />
      </Fragment>;
    })}
  </ol>;
}

function MessageRow({ message, own, continued, readerCount }: { message: ChatMessage; own: boolean; continued: boolean; readerCount?: number }) {
  const author = message.author;
  const name = accountDisplayName(author);
  const created = new Date(message.createdAt);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const canManage = own && !message.deletedAt;
  const invite = message.content && !message.deletedAt ? parseCodeArenaInvite(message.content) : null;
  return <li className={`group relative -mx-3 flex gap-3 px-3 py-0.5 transition-colors hover:bg-muted/60 sm:-mx-4 sm:px-4 ${continued ? "" : "mt-3 pt-1.5"}`} aria-label={`${name}, ${fullFormat.format(created)}`}>
    {canManage && !editing && <MessageOwnerActions onEdit={() => setEditing(true)} onDelete={() => setConfirmingDelete(true)} className="absolute right-3 top-0 z-10 border border-border bg-card opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 sm:right-4" />}
    {canManage && <DeleteMessageDialog message={message} open={confirmingDelete} onOpenChange={setConfirmingDelete} />}
    <div className="w-10 shrink-0">
      {continued
        ? <time dateTime={message.createdAt} title={fullFormat.format(created)} className="block pt-1 text-right text-[11px] leading-5 text-muted-foreground opacity-0 tabular-nums group-hover:opacity-100 group-focus-within:opacity-100">{timeFormat.format(created)}</time>
        : <Link href={`/profile/${encodeURIComponent(author.id)}`} aria-label={`View ${name}'s profile`} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <AccountAvatar source={accountImageSource(author.avatarUrl)} seed={author.id} label={`${name} avatar`} size={40} className="size-10 object-cover" />
        </Link>}
    </div>
    <div className="min-w-0 flex-1">
      {!continued && <div className="flex flex-wrap items-baseline gap-x-2">
        <Link href={`/profile/${encodeURIComponent(author.id)}`} className={`text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-ring ${own ? "text-nook-accent-text" : ""}`}>{name}</Link>
        <time dateTime={message.createdAt} title={fullFormat.format(created)} className="text-xs text-muted-foreground tabular-nums">{timeFormat.format(created)}</time>
        {own && <span className="sr-only">(you)</span>}
      </div>}
      {message.deletedAt
        ? <p className="text-sm italic text-muted-foreground">Message deleted</p>
        : editing
          ? <MessageEditor message={message} onClose={() => setEditing(false)} submitOnEnter />
          : invite
            ? <DuelInviteCard code={invite.code} own={own} authorName={name} />
          : message.content && <>
            <ChatMarkdown>{message.content}</ChatMarkdown>
            {message.editedAt && <span className="text-[11px] text-muted-foreground">(edited)</span>}
          </>}
      {!message.deletedAt && message.attachments?.length > 0 && <div className="mt-2 flex flex-wrap gap-3 pb-1">{message.attachments.map(key => <MessageAttachment key={key} conversationId={message.conversationId} objectKey={key} />)}</div>}
      {readerCount !== undefined && <p className="mt-1 text-right text-[11px] text-muted-foreground" aria-label={readerCount === 1 ? "Read by one person" : `Read by ${readerCount} people`}>{readerCount === 1 ? "Read" : `Read by ${readerCount}`}</p>}
    </div>
  </li>;
}

export function MessageAttachment({ conversationId, objectKey }: { conversationId: string; objectKey: string }) {
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
  if (query.isPending) return <div role="status" aria-label="Loading attachment" className="h-40 w-56 animate-pulse bg-muted" />;
  if (query.isError) return <button type="button" onClick={() => void query.refetch()} className="grid h-24 w-56 place-items-center border border-border bg-card px-3 text-xs text-destructive focus-visible:outline-2 focus-visible:outline-ring">Attachment unavailable · Retry</button>;
  const previewUrl = query.data.previewUrl;
  if (previewUrl && query.data.contentType.startsWith("video/")) {
    return <video src={previewUrl} controls preload="metadata" playsInline aria-label="Video attachment" className="max-h-80 w-auto max-w-full border border-border bg-black" />;
  }
  if (previewUrl && query.data.contentType.startsWith("image/")) {
    return <a href={previewUrl} target="_blank" rel="noreferrer" className="block max-w-full overflow-hidden border border-border bg-card focus-visible:outline-2 focus-visible:outline-ring" aria-label="Open image attachment in a new tab">
      <Image src={previewUrl} alt="Chat attachment" width={640} height={480} unoptimized className="max-h-80 w-auto max-w-full object-contain" />
    </a>;
  }
  return <div className="flex min-h-16 w-72 max-w-full items-center gap-3 border border-border bg-card px-3 py-2">
    <IconFileTypePdf size={26} stroke={1.75} className="shrink-0 text-primary" aria-hidden="true" />
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">PDF document</span>{downloadError ? <span role="alert" className="block text-xs text-destructive">{downloadError}</span> : <span className="block text-xs text-muted-foreground">Attachment</span>}</span>
    <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" onClick={() => { setDownloadError(""); void download(); }} aria-label="Download PDF"><IconDownload size={18} aria-hidden="true" /></Button>
  </div>;
}

function DuelInviteCard({ code, own, authorName }: { code: string; own: boolean; authorName: string }) {
  const { session, requestWithSession } = useAuth();
  const query = useQuery({
    queryKey: ["game", "room-lookup", code],
    queryFn: async () => {
      return requestWithSession(async (token) => {
        const client = new LobbyClient("/api/game", session?.user.id ?? "", token);
        return client.lookupRoom(code);
      });
    },
    enabled: Boolean(session),
    staleTime: 5000,
    refetchInterval: 10000,
  });

  const isExpired = query.data && (query.data.status === "expired" || query.data.status === "closed");
  const isMatched = query.data?.status === "matched";
  const isOpen = query.data?.status === "open";

  return (
    <section className="my-2 max-w-sm border border-primary/30 bg-primary/5 p-3" aria-label="Code Arena duel invitation">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <IconDeviceGamepad2 size={17} className="text-primary" aria-hidden="true" />
          Code Arena · 1v1 Duel
        </div>
        {isOpen && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Open</span>}
        {isMatched && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">In Match</span>}
        {isExpired && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Expired</span>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {isExpired
          ? "This challenge room has expired or ended."
          : isMatched
            ? "The match is currently underway or finished."
            : own
              ? "You sent a duel challenge."
              : `${authorName} challenged you to a duel.`}
      </p>
      {isMatched && query.data?.room?.matchId ? (
        <Button render={<Link href={`/play/match/${query.data.room.matchId}`} />} size="sm" variant="outline" className="mt-3 min-h-10">
          View Match
        </Button>
      ) : isExpired ? (
        <Button disabled size="sm" variant="outline" className="mt-3 min-h-10 opacity-50">
          Room Expired
        </Button>
      ) : (
        <Button render={<Link href={`/play/lobby/${code}`} />} size="sm" className="mt-3 min-h-10">
          {own ? "Open Lobby" : "Accept & Join"}
        </Button>
      )}
    </section>
  );
}
