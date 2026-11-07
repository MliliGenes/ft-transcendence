import type { Metadata } from "next";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Chat — Nook" };

export default function ChatPage() {
  return <ComingSoon title="Chat" />;
}
