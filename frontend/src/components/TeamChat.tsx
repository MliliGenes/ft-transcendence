import { useEffect, useState } from "react";
import {
  type TeamChatClient,
  type TeamChatEntry,
  type TeamPing,
  TEAM_PINGS,
  TEAM_PING_LABELS,
} from "../arena/chat.js";

interface FallbackMessage {
  id: string;
  from: string;
  text: string;
  type: "text";
}

function statusColorClass(status: string): string {
  if (status === "connected") return "text-teal-700";
  if (status === "error") return "text-red-700";
  return "text-neutral-500";
}

function ChatHeader({
  hasClient,
  status,
  readOnly,
}: {
  hasClient: boolean;
  status: string;
  readOnly: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
      <h4 className="font-mono text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Team chat
      </h4>
      {hasClient && (
        <span className={`font-mono text-xs ${statusColorClass(status)}`}>
          {readOnly ? "closed" : status}
        </span>
      )}
    </div>
  );
}

function PingItem({
  entry,
  senderLabel,
}: {
  entry: Extract<TeamChatEntry, { type: "ping" }>;
  senderLabel: string;
}) {
  return (
    <li className="text-xs text-neutral-700 bg-neutral-50 rounded px-1.5 py-0.5 border border-neutral-200">
      <span className="font-medium text-teal-700">{senderLabel} [PING]: </span>
      <span className="font-semibold text-neutral-900">
        {TEAM_PING_LABELS[entry.ping] ?? entry.ping}
      </span>
    </li>
  );
}

function ChatMessageItem({
  senderLabel,
  text,
}: {
  senderLabel: string;
  text: string;
}) {
  return (
    <li className="text-xs text-neutral-800 break-words">
      <span className="font-medium text-neutral-500">{senderLabel}: </span>
      <span>{text}</span>
    </li>
  );
}

function ChatEntryList({
  client,
  entries,
  fallbackMessages,
  currentUserId,
}: {
  client?: TeamChatClient | null;
  entries: TeamChatEntry[];
  fallbackMessages: FallbackMessage[];
  currentUserId: string;
}) {
  if (!client) {
    return (
      <ul aria-live="polite" className="max-h-36 space-y-1.5 overflow-y-auto px-3 py-2">
        {fallbackMessages.map((m) => (
          <ChatMessageItem key={m.id} senderLabel={m.from} text={m.text} />
        ))}
      </ul>
    );
  }

  return (
    <ul aria-live="polite" className="max-h-36 space-y-1.5 overflow-y-auto px-3 py-2">
      {entries.map((entry) => {
        const isYou = entry.senderUserId === currentUserId;
        const senderLabel = isYou ? "You" : entry.senderUserId;
        if (entry.type === "ping") {
          return <PingItem key={entry.id} entry={entry} senderLabel={senderLabel} />;
        }
        return <ChatMessageItem key={entry.id} senderLabel={senderLabel} text={entry.text} />;
      })}
    </ul>
  );
}

function QuickPingsToolbar({
  disabled,
  onSendPing,
}: {
  disabled: boolean;
  onSendPing: (ping: TeamPing) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-t border-neutral-200 bg-neutral-50 px-2 py-1.5" role="toolbar" aria-label="Team quick pings">
      {TEAM_PINGS.map((p) => (
        <button
          key={p}
          type="button"
          disabled={disabled}
          className="rounded border border-neutral-300 bg-white px-2 py-0.5 font-mono text-xs text-neutral-700 disabled:opacity-50"
          onClick={() => onSendPing(p)}
          aria-label={`Ping: ${TEAM_PING_LABELS[p]}`}
        >
          {TEAM_PING_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

function ChatComposer({
  draftText,
  disabled,
  readOnly,
  onDraftChange,
  onSubmit,
}: {
  draftText: string;
  disabled: boolean;
  readOnly: boolean;
  onDraftChange: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const isSendDisabled = disabled || !draftText.trim();
  const placeholder = readOnly ? "Match complete — chat closed" : "Message your team…";

  return (
    <form className="flex gap-2 border-t border-neutral-200 p-2" onSubmit={onSubmit}>
      <input
        aria-label="Team message"
        className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-xs disabled:bg-neutral-100 disabled:text-neutral-500"
        value={draftText}
        onChange={(e) => onDraftChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={500}
      />
      <button
        type="submit"
        className="rounded bg-teal-700 px-2 py-1 text-xs text-white disabled:opacity-50"
        aria-label="Send team message"
        disabled={isSendDisabled}
      >
        ›
      </button>
    </form>
  );
}

function ChatErrorAlerts({
  error,
  actionError,
}: {
  error: string | null;
  actionError: string | null;
}) {
  return (
    <>
      {error && (
        <p role="alert" className="border-b border-neutral-200 px-3 py-1 font-mono text-xs text-red-700">
          Chat: {error}
        </p>
      )}
      {actionError && (
        <p role="alert" className="border-b border-neutral-200 px-3 py-1 font-mono text-xs text-red-700">
          {actionError}
        </p>
      )}
    </>
  );
}

function isChatDisabled(readOnly: boolean, client: TeamChatClient | null | undefined, status: string): boolean {
  if (readOnly) return true;
  return Boolean(client && status !== "connected");
}

function useTeamChatState(client?: TeamChatClient | null) {
  const [entries, setEntries] = useState<TeamChatEntry[]>(() => client?.getMessages() ?? []);
  const [status, setStatus] = useState(client?.status ?? "connected");
  const [error, setError] = useState<string | null>(client?.error ?? null);

  useEffect(() => {
    if (!client) return;
    const sync = () => {
      setEntries(client.getMessages());
      setStatus(client.status);
      setError(client.error);
    };
    sync();
    return client.subscribe(sync);
  }, [client]);

  return { entries, status, error };
}

function useChatActions(
  client: TeamChatClient | null | undefined,
  setFallbackMessages: React.Dispatch<React.SetStateAction<FallbackMessage[]>>,
  setDraft: React.Dispatch<React.SetStateAction<{ text: string }>>,
  draft: { text: string }
) {
  const [actionError, setActionError] = useState<string | null>(null);

  const sendText = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const text = draft.text.trim();
    if (!text) return;

    try {
      if (client) {
        await client.sendMessage(text);
      } else {
        setFallbackMessages((prev) => [
          ...prev,
          { id: String(Date.now()), from: "You", text, type: "text" },
        ]);
      }
      setDraft((current) => (current === draft ? { text: "" } : current));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "failed to send message");
    }
  };

  const sendPing = async (ping: TeamPing) => {
    setActionError(null);
    if (!client) return;
    try {
      await client.sendPing(ping);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "failed to send ping");
    }
  };

  return { actionError, sendText, sendPing };
}

export function TeamChat({
  client,
  readOnly = false,
}: {
  client?: TeamChatClient | null;
  readOnly?: boolean;
}) {
  const { entries, status, error } = useTeamChatState(client);
  const [fallbackMessages, setFallbackMessages] = useState<FallbackMessage[]>([]);
  const [draft, setDraft] = useState({ text: "" });
  const { actionError, sendText, sendPing } = useChatActions(client, setFallbackMessages, setDraft, draft);

  const currentUserId = client?.options.userId ?? "You";
  const disabled = isChatDisabled(readOnly, client, status);
  const showPings = Boolean(client && !readOnly);

  return (
    <section aria-label="Team chat" className="rounded-md border border-neutral-200 bg-white">
      <ChatHeader hasClient={Boolean(client)} status={status} readOnly={readOnly} />
      <ChatErrorAlerts error={error} actionError={actionError} />
      <ChatEntryList
        client={client}
        entries={entries}
        fallbackMessages={fallbackMessages}
        currentUserId={currentUserId}
      />
      {showPings && <QuickPingsToolbar disabled={disabled} onSendPing={(ping) => void sendPing(ping)} />}
      <ChatComposer
        draftText={draft.text}
        disabled={disabled}
        readOnly={readOnly}
        onDraftChange={(text) => setDraft({ text })}
        onSubmit={sendText}
      />
    </section>
  );
}
