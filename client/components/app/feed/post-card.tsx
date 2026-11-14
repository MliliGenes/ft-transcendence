"use client";

import { useState } from "react";
import Link from "next/link";
import { AccountAvatar } from "@/components/app/account-avatar";
import { ChatMarkdown } from "@/components/app/chat/chat-markdown";
import { DeleteMessageDialog, MessageEditor, MessageOwnerActions } from "@/components/app/chat/message-actions";
import { AttachmentCarousel } from "@/components/app/feed/attachment-carousel";
import { accountImageSource } from "@/lib/accounts/images";
import { accountDisplayName } from "@/lib/accounts/status-icons";
import type { ChatMessage } from "@/lib/chat/client";

const fullFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" });
const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const dateYearFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

function relativeTime(date: Date) {
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d`;
  return (date.getFullYear() === new Date().getFullYear() ? dateFormat : dateYearFormat).format(date);
}

/** One feed post: a chat message presented as a card. */
export function PostCard({ post, own }: { post: ChatMessage; own: boolean }) {
  const author = post.author;
  const name = accountDisplayName(author);
  const created = new Date(post.createdAt);
  const profileHref = `/profile/${encodeURIComponent(author.id)}`;
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <article aria-label={`Post by ${name}`} className="border border-border bg-card p-4 sm:p-5">
      <header className="flex items-center gap-3">
        <Link href={profileHref} aria-label={`View ${name}'s profile`} className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <AccountAvatar source={accountImageSource(author.avatarUrl)} seed={author.id} label={`${name}'s avatar`} size={44} className="size-11 object-cover" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={profileHref} className={`block truncate text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-ring ${own ? "text-nook-accent-text" : ""}`}>{name}</Link>
          <p className="truncate text-xs text-muted-foreground">
            @{author.username} · <time dateTime={post.createdAt} title={fullFormat.format(created)}>{relativeTime(created)}</time>
            {post.editedAt && <span> · edited</span>}
          </p>
        </div>
        {own && !editing && <MessageOwnerActions noun="post" onEdit={() => setEditing(true)} onDelete={() => setConfirmingDelete(true)} className="shrink-0" />}
      </header>
      {own && <DeleteMessageDialog message={post} noun="post" open={confirmingDelete} onOpenChange={setConfirmingDelete} />}
      {editing
        ? <div className="mt-3"><MessageEditor message={post} onClose={() => setEditing(false)} /></div>
        : post.content && <ChatMarkdown className="mt-3 text-[15px] leading-6">{post.content}</ChatMarkdown>}
      {post.attachments?.length > 0 && <AttachmentCarousel conversationId={post.conversationId} attachments={post.attachments} />}
    </article>
  );
}
