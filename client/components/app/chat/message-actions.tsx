'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import { useAuth } from '@/components/auth/auth-provider';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AuthRequestError } from '@/lib/auth/client';
import { chatApi, type ChatMessage } from '@/lib/chat/client';

const MAX_LENGTH = 2000;
// Chat history, the feed and profile post lists all hold copies of a message.
const messageCaches = ['messages', 'feed-posts'] as const;

function failureText(error: unknown, action: string) {
  if (error instanceof AuthRequestError && error.status === 404)
    return 'This message is no longer available.';
  return error instanceof Error
    ? error.message
    : `Unable to ${action} this message. Please try again.`;
}

/**
 * Applies a change everywhere the message is cached, then refetches. Other
 * clients are not notified by the server and pick the change up on their next poll.
 */
function applyToCaches(
  queryClient: QueryClient,
  messageId: string,
  change: (message: ChatMessage) => ChatMessage,
) {
  for (const cache of messageCaches) {
    queryClient.setQueriesData<InfiniteData<ChatMessage[]>>(
      { queryKey: ['chat', cache] },
      (data) =>
        data && {
          ...data,
          pages: data.pages.map((page) =>
            page.map((item) => (item.id === messageId ? change(item) : item)),
          ),
        },
    );
    void queryClient.invalidateQueries({ queryKey: ['chat', cache] });
  }
}

/** Inline editor that replaces a message body until saved or cancelled. */
export function MessageEditor({
  message,
  onClose,
  submitOnEnter = false,
}: {
  message: ChatMessage;
  onClose: () => void;
  submitOnEnter?: boolean;
}) {
  const { requestWithSession } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState(message.content ?? '');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = text.trim();

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);

  const edit = useMutation({
    mutationFn: (content: string) =>
      requestWithSession((token) =>
        chatApi.editMessage(message.id, content, token),
      ),
    onSuccess: (updated) => {
      applyToCaches(queryClient, message.id, (item) =>
        item.version > updated.version ? item : updated,
      );
      onClose();
    },
  });

  function save(event?: FormEvent) {
    event?.preventDefault();
    if (edit.isPending || !trimmed) return;
    if (trimmed === message.content) {
      onClose();
      return;
    }
    edit.mutate(trimmed);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!edit.isPending) onClose();
      return;
    }
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    if (event.ctrlKey || event.metaKey || (submitOnEnter && !event.shiftKey)) {
      event.preventDefault();
      save();
    }
  }

  return (
    <form onSubmit={save} className="mt-1 w-full">
      <label htmlFor={`edit-${message.id}`} className="sr-only">
        Edit message
      </label>
      <Textarea
        ref={inputRef}
        id={`edit-${message.id}`}
        value={text}
        maxLength={MAX_LENGTH}
        disabled={edit.isPending}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        className="min-h-20 resize-y"
      />
      {edit.isError && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {failureText(edit.error, 'edit')}
        </p>
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        <span className="mr-auto text-xs text-muted-foreground">
          Esc to cancel · {submitOnEnter ? 'Enter' : 'Ctrl+Enter'} to save
        </span>
        <Button
          type="button"
          variant="ghost"
          className="min-h-9 px-3"
          disabled={edit.isPending}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="min-h-9 px-4"
          disabled={edit.isPending || !trimmed}
        >
          {edit.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

export function DeleteMessageDialog({
  message,
  open,
  onOpenChange,
  noun = 'message',
}: {
  message: ChatMessage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noun?: string;
}) {
  const { requestWithSession } = useAuth();
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () =>
      requestWithSession((token) => chatApi.deleteMessage(message.id, token)),
    onSuccess: () => {
      const deletedAt = new Date().toISOString();
      applyToCaches(queryClient, message.id, (item) => ({
        ...item,
        content: null,
        deletedAt,
        version: item.version + 1,
      }));
      onOpenChange(false);
    },
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) remove.reset();
        onOpenChange(next);
      }}
      title={`Delete this ${noun}?`}
      description={
        remove.isError
          ? failureText(remove.error, 'delete')
          : 'This can’t be undone.'
      }
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      pending={remove.isPending}
      destructive
      onConfirm={() => remove.mutate()}
    />
  );
}

/** Edit and delete buttons shown to the author of a message. */
export function MessageOwnerActions({
  noun = 'message',
  onEdit,
  onDelete,
  className = '',
}: {
  noun?: string;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}) {
  const buttonClass =
    'inline-flex size-9 items-center justify-center text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring';
  return (
    <div className={`flex ${className}`}>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${noun}`}
        title="Edit"
        className={`${buttonClass} hover:text-foreground`}
      >
        <IconPencil size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${noun}`}
        title="Delete"
        className={`${buttonClass} hover:text-destructive`}
      >
        <IconTrash size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
