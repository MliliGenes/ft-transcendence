"use client";

import { useEffect, useState } from "react";
import { IconMessageCircle, IconSend } from "@tabler/icons-react";
import { TeamChatClient, TEAM_PINGS, TEAM_PING_LABELS, type TeamChatEntry, type TeamPing } from "@/lib/arena/chat";
import { Button } from "@/components/ui/button";

export interface TeamChatProps {
  client: TeamChatClient | null;
}

export function TeamChat({ client }: TeamChatProps) {
  const [messages, setMessages] = useState<TeamChatEntry[]>(() => client?.getMessages() ?? []);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!client) return;
    setMessages(client.getMessages());
    return client.subscribe(() => {
      setMessages(client.getMessages());
    });
  }, [client]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!client || !text.trim() || sending) return;
    setSending(true);
    try {
      await client.sendMessage(text);
      setText("");
    } catch {
      // Error handled by chat client state
    } finally {
      setSending(false);
    }
  }

  async function handlePing(ping: TeamPing) {
    if (!client) return;
    try {
      await client.sendPing(ping);
    } catch {
      // Error handled by chat client state
    }
  }

  if (!client) return null;

  return (
    <div className="flex h-full flex-col border-t border-border bg-card text-card-foreground">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
        <IconMessageCircle className="size-4 text-primary" />
        <span>Team Chat (2v2)</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground italic">
            No team messages yet. Coordinate your strategy here!
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="rounded bg-secondary/40 p-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">{m.senderUserId}</span>
                <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="mt-1 text-foreground">
                {"ping" in m ? (
                  <span className="inline-block rounded bg-primary/20 px-1.5 py-0.5 text-primary font-medium">
                    {TEAM_PING_LABELS[m.ping as TeamPing] ?? m.ping}
                  </span>
                ) : (
                  <span>{m.text}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-t border-border p-2 bg-secondary/20">
        {TEAM_PINGS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handlePing(p)}
            className="rounded border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
          >
            {TEAM_PING_LABELS[p]}
          </button>
        ))}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type team message…"
          disabled={sending}
          className="flex-1 rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button type="submit" size="sm" disabled={sending || !text.trim()}>
          <IconSend className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}
