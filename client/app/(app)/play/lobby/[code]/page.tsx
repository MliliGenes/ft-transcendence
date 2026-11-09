import type { Metadata } from "next";
import { LobbyView } from "@/components/arena/LobbyView";

export const metadata: Metadata = { title: "Lobby — Code Arena — Nook" };
export const instant = false;

export default async function LobbyRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <LobbyView code={code} />;
}
