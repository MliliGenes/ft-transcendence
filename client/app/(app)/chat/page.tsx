import type { Metadata } from "next";
import { ChatWorkspace } from "@/components/app/chat-workspace";

export const metadata: Metadata = { title: "Chat — Nook" };

export default function ChatPage() {
  return <ChatWorkspace />;
}
