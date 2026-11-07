import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatWorkspace } from "@/components/app/chat-workspace";

export const metadata: Metadata = { title: "Chat — Nook" };

type ChatPageProps = { searchParams: Promise<{ conversation?: string | string[] }> };

async function ChatContent({ searchParams }: ChatPageProps) {
  const { conversation } = await searchParams;
  const id = typeof conversation === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversation) ? conversation : undefined;
  return <ChatWorkspace key={id ?? "directory"} initialConversationId={id} />;
}

export default function ChatPage(props: ChatPageProps) {
  return <Suspense fallback={<div role="status" className="p-6 text-sm text-muted-foreground">Loading chat…</div>}><ChatContent {...props} /></Suspense>;
}
