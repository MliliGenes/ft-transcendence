"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { IconFileTypePdf, IconMovie, IconPhoto, IconSend, IconX } from "@tabler/icons-react";
import { AccountAvatar } from "@/components/app/account-avatar";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { useCurrentAccount } from "@/hooks/use-current-account";
import { accountImageSource } from "@/lib/accounts/images";
import { accountDisplayName } from "@/lib/accounts/status-icons";
import { attachmentAccept, isVideo, MAX_ATTACHMENTS, validateAttachments } from "@/lib/chat/attachments";
import { chatApi } from "@/lib/chat/client";

const MAX_LENGTH = 2000;

function FileChip({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled: boolean }) {
  const Icon = isVideo(file) ? IconMovie : file.type === "application/pdf" ? IconFileTypePdf : IconPhoto;
  return (
    <li className="flex max-w-full items-center gap-2 border border-border bg-background py-1 pl-2.5 pr-1 text-xs">
      <Icon size={15} className="shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 max-w-48 truncate">{file.name}</span>
      <button type="button" onClick={onRemove} disabled={disabled} aria-label={`Remove ${file.name}`} className="inline-flex size-7 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"><IconX size={14} aria-hidden="true" /></button>
    </li>
  );
}

/** "What's on your mind?" box. A post is one message in the feed channel. */
export function FeedComposer({ channelId, onPosted }: { channelId: string; onPosted: () => void }) {
  const { session, requestWithSession } = useAuth();
  const account = useCurrentAccount();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ label: string; percent: number } | null>(null);
  // Same request id on retry keeps the send idempotent; uploaded keys avoid re-uploading.
  const requestIdRef = useRef("");
  const uploadedRef = useRef(new Map<File, string>());

  const post = useMutation({
    mutationFn: ({ content, selected }: { content: string; selected: File[] }) => requestWithSession(async token => {
      requestIdRef.current ||= crypto.randomUUID();
      const keys: string[] = [];
      const total = selected.reduce((sum, file) => sum + file.size, 0) || 1;
      let done = 0;
      for (const [index, file] of selected.entries()) {
        const label = selected.length > 1 ? `Uploading ${index + 1} of ${selected.length}` : `Uploading ${file.name}`;
        let key = uploadedRef.current.get(file);
        if (!key) {
          setProgress({ label, percent: Math.round((done / total) * 100) });
          const upload = await chatApi.createAttachmentUpload(channelId, file.type, token);
          if (file.size > upload.maxBytes) throw new Error(`${file.name} exceeds the ${Math.floor(upload.maxBytes / 1024 / 1024)} MB limit.`);
          await chatApi.uploadFile(upload, file, loaded => setProgress({ label, percent: Math.min(100, Math.round(((done + loaded) / total) * 100)) }));
          key = upload.objectKey;
          uploadedRef.current.set(file, key);
        }
        done += file.size;
        keys.push(key);
      }
      setProgress(null);
      return chatApi.send(channelId, content, requestIdRef.current, token, keys);
    }),
    onMutate: () => setError(""),
    onSuccess: () => {
      setText("");
      setFiles([]);
      requestIdRef.current = "";
      uploadedRef.current.clear();
      onPosted();
    },
    onError: err => {
      setProgress(null);
      setError(err instanceof Error ? err.message : "Couldn’t publish your post. Please try again.");
    },
  });

  const user = session?.user;
  if (!user) return null;
  const name = accountDisplayName(account.data ?? { username: user.username, displayName: null });
  const trimmed = text.trim();
  const canPost = trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !post.isPending;

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canPost) return;
    post.mutate({ content: trimmed, selected: files });
  }

  function addFiles(incoming: File[]) {
    const combined = [...files, ...incoming];
    const problem = validateAttachments(combined);
    if (problem) { setError(problem); return; }
    setError("");
    requestIdRef.current = "";
    setFiles(combined);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submit();
  }

  const remaining = MAX_LENGTH - text.length;

  return (
    <form onSubmit={submit} aria-label="Create a post" className="border border-border bg-card p-4 sm:p-5">
      <div className="flex gap-3">
        <AccountAvatar source={accountImageSource(account.data?.avatarUrl ?? null)} seed={user.id} label={`${name}'s avatar`} size={44} className="size-11 shrink-0 object-cover" />
        <div className="min-w-0 flex-1">
          <label htmlFor="feed-post" className="sr-only">What’s on your mind?</label>
          <textarea
            id="feed-post"
            rows={3}
            maxLength={MAX_LENGTH}
            value={text}
            disabled={post.isPending}
            onChange={event => { setText(event.target.value); requestIdRef.current = ""; }}
            onKeyDown={onKeyDown}
            placeholder={`What’s on your mind, ${name}?`}
            className="block w-full resize-none bg-transparent py-2 text-base leading-6 outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          {files.length > 0 && <ul aria-label="Attachments" className="mt-2 flex flex-wrap gap-2">{files.map(file => <FileChip key={`${file.name}-${file.size}-${file.lastModified}`} file={file} disabled={post.isPending} onRemove={() => { setFiles(files.filter(item => item !== file)); uploadedRef.current.delete(file); requestIdRef.current = ""; }} />)}</ul>}
        </div>
      </div>

      {progress && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span className="truncate">{progress.label}</span><span className="tabular-nums">{progress.percent}%</span></div>
          <div role="progressbar" aria-label={progress.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} className="h-1.5 w-full overflow-hidden bg-muted"><div className="h-full bg-primary transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${progress.percent}%` }} /></div>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2 px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-within:outline-2 focus-within:outline-ring ${post.isPending || files.length >= MAX_ATTACHMENTS ? "pointer-events-none opacity-50" : ""}`}>
          <IconPhoto size={18} className="text-primary" aria-hidden="true" />
          <span>Photo / video</span>
          <input type="file" multiple accept={attachmentAccept} disabled={post.isPending || files.length >= MAX_ATTACHMENTS} className="sr-only" onChange={event => { const incoming = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; addFiles(incoming); }} />
        </label>
        <span className={`ml-auto text-xs tabular-nums ${remaining <= 100 ? "text-destructive" : "text-muted-foreground"}`}>{remaining}</span>
        <Button type="submit" disabled={!canPost} className="min-h-10 gap-2 px-5"><IconSend size={16} aria-hidden="true" />{post.isPending ? "Posting…" : "Post"}</Button>
      </div>
    </form>
  );
}
